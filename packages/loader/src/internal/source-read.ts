import type { Expression, ExpressionBuilder, SqlBool } from 'kysely';
import { sql } from 'kysely';
import { getGtfsJpV4TableSchema, type GtfsJpV4TableName, type GtfsRow } from '@gtfs-jp/types';

import type { SourceReadColumns, SourceReadOptions, SourceReadRow } from '../schema-types.js';
import type { WhereExpr, WhereInput } from '../where.js';
import { makeWhereExprBuilder } from '../where.js';
import { assertIdentifier } from './sql.js';
import { createSessionDb, type GtfsSourceDatabase } from './session-db.js';
import { SqliteSession } from './session.js';

const shouldCoerceToNumber = (tableName: GtfsJpV4TableName, columnName: string): boolean => {
  const schema = getGtfsJpV4TableSchema(tableName);
  const columns = schema.columns as Record<
    string,
    {
      kind?: 'string' | 'number';
      values?: readonly (string | number)[];
    }
  >;
  const column = columns[columnName];
  if (!column) {
    return false;
  }

  if (column.kind === 'number') {
    return true;
  }

  if (!column.values || column.values.length === 0) {
    return false;
  }

  return typeof column.values[0] === 'number';
};

const coerceRow = (tableName: GtfsJpV4TableName, row: GtfsRow): GtfsRow => {
  const nextRow: GtfsRow = {};

  for (const [columnName, value] of Object.entries(row)) {
    if (value === null || value === undefined || !shouldCoerceToNumber(tableName, columnName)) {
      nextRow[columnName] = value;
      continue;
    }

    if (typeof value === 'number') {
      nextRow[columnName] = value;
      continue;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`Failed to coerce ${tableName}.${columnName} to number: ${String(value)}`);
    }

    nextRow[columnName] = numericValue;
  }

  return nextRow;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const applyWhereExpr = (eb: ExpressionBuilder<any, any>, expr: WhereExpr): Expression<SqlBool> => {
  switch (expr.kind) {
    case 'cond': {
      if (expr.op === 'is null') return eb(expr.col, 'is', null);
      if (expr.op === 'is not null') return eb(expr.col, 'is not', null);
      if (expr.op === 'in' || expr.op === 'not in') {
        const vals = Array.isArray(expr.val) ? expr.val : [expr.val ?? null];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return eb(expr.col as any, expr.op, vals as any);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return eb(expr.col as any, expr.op as any, (expr.val ?? null) as any);
    }
    case 'and':
      return eb.and(expr.exprs.map((e) => applyWhereExpr(eb, e)));
    case 'or':
      return eb.or(expr.exprs.map((e) => applyWhereExpr(eb, e)));
    case 'not':
      return eb.not(applyWhereExpr(eb, expr.expr));
  }
};

const applyWhere = <Q extends { where: (...args: never[]) => Q }>(
  query: Q,
  where: WhereInput | undefined,
): Q => {
  if (!where) return query;
  const expr = typeof where === 'function' ? where(makeWhereExprBuilder()) : where;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (query as any).where((eb: ExpressionBuilder<any, any>) => applyWhereExpr(eb, expr)) as Q;
};

export const readTypedGtfsSourceRows = async <
  TName extends GtfsJpV4TableName,
  TColumns extends SourceReadColumns<TName> | undefined = undefined,
>(
  session: SqliteSession,
  tableName: TName,
  options: SourceReadOptions<TName, TColumns> = {},
): Promise<Array<SourceReadRow<TName, TColumns>>> => {
  const db = createSessionDb<GtfsSourceDatabase>(session);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db.selectFrom(tableName);

  if (options.columns && options.columns.length > 0) {
    query = query.select(options.columns);
  } else {
    query = query.selectAll();
  }

  query = applyWhere(query, options.where);

  if (options.orderBy) {
    const terms = (
      Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]
    ) as string[];
    for (const term of terms) {
      const trimmed = term.trim();
      const spaceIdx = trimmed.lastIndexOf(' ');
      if (spaceIdx === -1) {
        assertIdentifier(trimmed);
        query = query.orderBy(sql.ref(trimmed));
      } else {
        const col = trimmed.slice(0, spaceIdx);
        const dir = trimmed.slice(spaceIdx + 1).toLowerCase();
        if (dir !== 'asc' && dir !== 'desc') {
          throw new Error(`Invalid ORDER BY direction: ${dir}`);
        }
        assertIdentifier(col);
        query = query.orderBy(sql.ref(col), dir);
      }
    }
  }

  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  if (options.offset !== undefined && options.offset > 0) {
    query = query.offset(options.offset);
  }

  const rows = (await query.execute()) as GtfsRow[];
  return rows.map((row) => coerceRow(tableName, row)) as Array<SourceReadRow<TName, TColumns>>;
};
