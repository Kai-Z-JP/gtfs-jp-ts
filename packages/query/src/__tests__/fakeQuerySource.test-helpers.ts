import type { GtfsQuerySource } from '../types.js';

type TableRows = Record<string, Array<Record<string, unknown>>>;

type ParsedTable = {
  tableName: string;
  alias: string | null;
};

type WhereClause = {
  column: string;
  op: string;
  value: unknown;
};

const parseTable = (value: string): ParsedTable => {
  const match = /^([A-Za-z_][\w]*)(?:\s+as\s+([A-Za-z_][\w]*))?$/i.exec(value.trim());
  if (!match) {
    throw new Error(`Unsupported table expression: ${value}`);
  }

  return {
    tableName: match[1],
    alias: match[2] ?? null,
  };
};

const prefixRow = (row: Record<string, unknown>, alias: string | null): Record<string, unknown> => {
  if (!alias) {
    return { ...row };
  }

  return Object.fromEntries(Object.entries(row).map(([key, value]) => [`${alias}.${key}`, value]));
};

const parseSelectedColumn = (value: string): { sourceKey: string; outputKey: string } => {
  const match = /^(.+?)\s+as\s+([A-Za-z_][\w]*)$/i.exec(value.trim());
  if (!match) {
    const key = value.trim();
    return { sourceKey: key, outputKey: key };
  }

  return {
    sourceKey: match[1].trim(),
    outputKey: match[2],
  };
};

const compareValues = (left: unknown, right: unknown): number => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'ja');
};

class FakeQueryBuilder {
  private readonly joins: Array<{
    table: ParsedTable;
    leftColumn: string;
    rightColumn: string;
  }> = [];

  private readonly whereClauses: WhereClause[] = [];
  private selectedColumns: string[] = [];
  private orderColumns: string[] = [];
  private distinctRows = false;
  private limitCount: number | null = null;

  constructor(
    private readonly tables: TableRows,
    private readonly baseTable: ParsedTable,
  ) {}

  innerJoin(tableName: string, leftColumn: string, rightColumn: string): this {
    this.joins.push({
      table: parseTable(tableName),
      leftColumn,
      rightColumn,
    });
    return this;
  }

  where(column: string, op: string, value: unknown): this {
    this.whereClauses.push({ column, op, value });
    return this;
  }

  select(columns: string[]): this {
    this.selectedColumns = columns;
    return this;
  }

  orderBy(column: string): this {
    this.orderColumns.push(column);
    return this;
  }

  distinct(): this {
    this.distinctRows = true;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  async execute(): Promise<Array<Record<string, unknown>>> {
    let rows = (this.tables[this.baseTable.tableName] ?? []).map((row) =>
      prefixRow(row, this.baseTable.alias),
    );

    for (const join of this.joins) {
      const joinRows = (this.tables[join.table.tableName] ?? []).map((row) =>
        prefixRow(row, join.table.alias),
      );
      rows = rows.flatMap((row) =>
        joinRows
          .filter((joinRow) => {
            const leftValue = row[join.leftColumn] ?? joinRow[join.leftColumn];
            const rightValue = row[join.rightColumn] ?? joinRow[join.rightColumn];
            return leftValue === rightValue;
          })
          .map((joinRow) => ({ ...row, ...joinRow })),
      );
    }

    rows = rows.filter((row) =>
      this.whereClauses.every((clause) => {
        const candidate = row[clause.column];
        if (clause.op === '=') return candidate === clause.value;
        if (clause.op === 'in')
          return Array.isArray(clause.value) && clause.value.includes(candidate);
        if (clause.op === 'is') return candidate === clause.value;
        if (clause.op === 'is not') return candidate !== clause.value;
        throw new Error(`Unsupported where operator: ${clause.op}`);
      }),
    );

    rows.sort((left, right) => {
      for (const column of this.orderColumns) {
        const diff = compareValues(left[column], right[column]);
        if (diff !== 0) return diff;
      }
      return 0;
    });

    let result = rows.map((row) =>
      Object.fromEntries(
        this.selectedColumns.map((column) => {
          const parsed = parseSelectedColumn(column);
          return [parsed.outputKey, row[parsed.sourceKey]];
        }),
      ),
    );

    if (this.distinctRows) {
      const seen = new Set<string>();
      result = result.filter((row) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (this.limitCount != null) {
      result = result.slice(0, this.limitCount);
    }

    return result;
  }
}

export const createFakeQuerySource = (tables: TableRows): GtfsQuerySource =>
  ({
    db: {
      selectFrom: (tableName: string) => new FakeQueryBuilder(tables, parseTable(tableName)),
    },
    hasTable: async (tableName: string) => Object.hasOwn(tables, tableName),
  }) as unknown as GtfsQuerySource;
