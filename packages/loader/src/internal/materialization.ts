import {GTFS_JP_V4_TABLE_NAMES, type GtfsJpV4TableName, type GtfsRow,} from "@gtfs-jp/types";

import type {
  DerivedBuildContext,
  DerivedBuilderProgress,
  DerivedColumnDefinition,
  DerivedColumnDefinitions,
  DerivedIndexDefinition,
  DerivedSqlBuild,
  DerivedTableBuild,
  GtfsSchemaDefinition,
  SourceReadColumns,
  SourceReadOptions,
  SourceReadRow,
} from "../schema-types.js";
import type {ImportProgressEmitter, ImportTargetKind, ImportTargetState, SqlBindMap, SqlBindValue} from "../types.js";
import {quoteIdentifier} from "./sql.js";
import {SqliteSession} from "./session.js";
import {readTypedGtfsSourceRows} from "./source-read.js";

const MATERIALIZATION_RUNS_TABLE = "_materialization_runs";
const MATERIALIZATION_TABLES_TABLE = "_materialization_tables";
const RESERVED_TABLE_PREFIX = "_materialization_";
const GTFS_SOURCE_SET = new Set<string>(GTFS_JP_V4_TABLE_NAMES);
const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

type CompiledDerivedTable = {
  name: string;
  dependsOn: readonly string[];
  derivedDependencies: readonly string[];
  columns: DerivedColumnDefinitions;
  columnNames: readonly string[];
  primaryKey: readonly string[];
  indexes: readonly DerivedIndexDefinition[];
  onError: "fail" | "skip";
  build: DerivedTableBuild<any, any>;
};

export type CompiledGtfsSchema = {
  derivedTables: readonly CompiledDerivedTable[];
  derivedTableNames: readonly string[];
};

export type MaterializationTableMetric = {
  targetKind: ImportTargetKind;
  tableName: string;
  state: ImportTargetState;
  rowsWritten: number;
  error?: string;
  skipReason?: string;
};

export type DerivedMaterializationResult = {
  derivedTablesMaterialized: number;
  derivedRowsWritten: number;
  skippedDerivedTables: string[];
  tableMetrics: MaterializationTableMetric[];
};

type DerivedExecutionArgs = {
  session: SqliteSession;
  compiledSchema: CompiledGtfsSchema;
  runtime: Record<string, unknown>;
  emit: ImportProgressEmitter;
  sourceMetrics: readonly MaterializationTableMetric[];
};

const assertIdentifier = (value: string, kind: string): void => {
  if (!SQL_IDENTIFIER_RE.test(value)) {
    throw new Error(`Invalid ${kind}: ${value}`);
  }
};

const normalizeColumns = (columns: DerivedColumnDefinitions, tableName: string): readonly string[] => {
  const columnNames = Object.keys(columns);
  if (columnNames.length === 0) {
    throw new Error(`Derived table "${tableName}" must define at least one column`);
  }

  for (const columnName of columnNames) {
    assertIdentifier(columnName, `column name in ${tableName}`);
    const column = columns[columnName];
    if (column.kind !== "string" && column.kind !== "number") {
      throw new Error(`Derived table "${tableName}" column "${columnName}" has an invalid kind`);
    }
  }

  return columnNames;
};

const normalizeIndexes = (
  tableName: string,
  columnNames: readonly string[],
  indexes: readonly DerivedIndexDefinition[] | undefined,
): readonly DerivedIndexDefinition[] => {
  if (!indexes) {
    return [];
  }

  const columnSet = new Set(columnNames);
  return indexes.map((index, indexPosition) => {
    if (index.columns.length === 0) {
      throw new Error(`Derived table "${tableName}" index #${indexPosition + 1} has no columns`);
    }
    for (const columnName of index.columns) {
      if (!columnSet.has(columnName)) {
        throw new Error(`Derived table "${tableName}" index references unknown column "${columnName}"`);
      }
    }
    const normalizedName = index.name ?? `${tableName}_${index.columns.join("_")}_idx`;
    assertIdentifier(normalizedName, `index name in ${tableName}`);
    return {
      name: normalizedName,
      columns: [...index.columns],
      unique: index.unique ?? false,
    };
  });
};

const toSortedDerivedTables = (derivedTables: readonly CompiledDerivedTable[]): readonly CompiledDerivedTable[] => {
  const tableByName = new Map(derivedTables.map((table) => [table.name, table]));
  const remaining = new Map(derivedTables.map((table) => [table.name, new Set(table.derivedDependencies)]));
  const ordered: CompiledDerivedTable[] = [];
  const ready = derivedTables
    .filter((table) => table.derivedDependencies.length === 0)
    .map((table) => table.name)
    .sort();

  while (ready.length > 0) {
    const nextName = ready.shift();
    if (!nextName) {
      break;
    }

    const nextTable = tableByName.get(nextName);
    if (!nextTable) {
      continue;
    }

    ordered.push(nextTable);
    remaining.delete(nextName);

    for (const [candidateName, dependencySet] of remaining.entries()) {
      if (!dependencySet.delete(nextName) || dependencySet.size > 0) {
        continue;
      }
      ready.push(candidateName);
      ready.sort();
    }
  }

  if (ordered.length !== derivedTables.length) {
    const unresolved = [...remaining.keys()].sort();
    throw new Error(`Derived table dependencies contain a cycle: ${unresolved.join(", ")}`);
  }

  return ordered;
};

export const compileGtfsSchema = (
  schema: GtfsSchemaDefinition | undefined,
): CompiledGtfsSchema => {
  const normalizedSchema = schema ?? { sources: "gtfs-jp-v4", derivedTables: [] };
  if ((normalizedSchema.sources ?? "gtfs-jp-v4") !== "gtfs-jp-v4") {
    throw new Error(`Unsupported source type: ${String(normalizedSchema.sources)}`);
  }

  const rawDerivedTables = normalizedSchema.derivedTables ?? [];
  const seenNames = new Set<string>();
  const derivedTableNames = rawDerivedTables.map((table) => table.name);
  const derivedTableNameSet = new Set(derivedTableNames);

  const compiled = rawDerivedTables.map<CompiledDerivedTable>((table) => {
    assertIdentifier(table.name, "derived table name");
    if (table.name.startsWith(RESERVED_TABLE_PREFIX)) {
      throw new Error(`Derived table "${table.name}" uses a reserved prefix`);
    }
    if (GTFS_SOURCE_SET.has(table.name)) {
      throw new Error(`Derived table "${table.name}" conflicts with a GTFS source table`);
    }
    if (seenNames.has(table.name)) {
      throw new Error(`Duplicate derived table name: ${table.name}`);
    }
    seenNames.add(table.name);

    const columnNames = normalizeColumns(table.columns, table.name);
    const columnSet = new Set(columnNames);
    const primaryKey = table.primaryKey ?? [];
    for (const columnName of primaryKey) {
      if (!columnSet.has(columnName)) {
        throw new Error(`Derived table "${table.name}" primary key references unknown column "${columnName}"`);
      }
    }

    const indexes = normalizeIndexes(table.name, columnNames, table.indexes);

    const dependsOn = [...(table.dependsOn ?? [])];
    for (const dependencyName of dependsOn) {
      assertIdentifier(dependencyName, `dependency in ${table.name}`);
      if (!GTFS_SOURCE_SET.has(dependencyName) && !derivedTableNameSet.has(dependencyName)) {
        throw new Error(`Derived table "${table.name}" depends on unknown table "${dependencyName}"`);
      }
    }

    return {
      name: table.name,
      dependsOn,
      derivedDependencies: dependsOn.filter((dependencyName) => derivedTableNameSet.has(dependencyName)),
      columns: table.columns,
      columnNames,
      primaryKey,
      indexes,
      onError: table.onError ?? "fail",
      build: table.build,
    };
  });

  return {
    derivedTables: toSortedDerivedTables(compiled),
    derivedTableNames: compiled.map((table) => table.name),
  };
};

const emitTargetEvent = (
  emit: ImportProgressEmitter,
  phase: "import" | "derive",
  targetKind: ImportTargetKind,
  targetName: string,
  state: ImportTargetState,
  message: string,
  extra: Partial<Pick<MaterializationTableMetric, "rowsWritten">> = {},
): void => {
  emit({
    phase,
    targetKind,
    targetName,
    state,
    message,
    rowsWritten: extra.rowsWritten,
  });
};

const columnSqlType = (column: DerivedColumnDefinition): string => (column.kind === "number" ? "INTEGER" : "TEXT");

const createDerivedTable = async (
  session: SqliteSession,
  table: CompiledDerivedTable,
): Promise<void> => {
  await session.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(table.name)};`);

  const columnSql = table.columnNames
    .map((columnName) => {
      const column = table.columns[columnName];
      const notNull = column.nullable === false ? " NOT NULL" : "";
      return `${quoteIdentifier(columnName)} ${columnSqlType(column)}${notNull}`;
    })
    .join(", ");

  const primaryKeySql =
    table.primaryKey.length > 0
      ? `, PRIMARY KEY (${table.primaryKey.map((columnName) => quoteIdentifier(columnName)).join(", ")})`
      : "";

  await session.exec(`CREATE TABLE ${quoteIdentifier(table.name)} (${columnSql}${primaryKeySql});`);
};

const createIndexes = async (session: SqliteSession, table: CompiledDerivedTable): Promise<void> => {
  for (const index of table.indexes) {
    const unique = index.unique ? "UNIQUE " : "";
    const columnsSql = index.columns.map((columnName) => quoteIdentifier(columnName)).join(", ");
    await session.exec(
      `CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdentifier(index.name as string)} ON ${quoteIdentifier(table.name)} (${columnsSql});`,
    );
  }
};

const countRows = async (session: SqliteSession, tableName: string): Promise<number> => {
  const rows = await session.execRows<{ count: number | string }>(
    `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)};`,
  );
  return Number(rows[0]?.count ?? 0);
};

const resolveSqlBind = async (
  bind: DerivedSqlBuild["bind"],
  context: DerivedBuildContext<Record<string, unknown>>,
): Promise<SqlBindMap> => {
  if (!bind) {
    return {};
  }
  return typeof bind === "function" ? await bind(context) : bind;
};

const toAsyncIterable = async function* <TRow>(
  iterable: Iterable<TRow> | AsyncIterable<TRow>,
): AsyncIterable<TRow> {
  for await (const row of iterable) {
    yield row;
  }
};

const normalizeValue = (
  column: DerivedColumnDefinition,
  columnName: string,
  tableName: string,
  value: SqlBindValue | undefined,
): SqlBindValue => {
  if (value === undefined) {
    if (column.nullable === false) {
      throw new Error(`Derived table "${tableName}" column "${columnName}" cannot be undefined`);
    }
    return null;
  }

  if (value === null) {
    if (column.nullable === false) {
      throw new Error(`Derived table "${tableName}" column "${columnName}" cannot be null`);
    }
    return null;
  }

  if (column.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Derived table "${tableName}" column "${columnName}" must be a finite number`);
    }
    return value;
  }

  if (typeof value !== "string") {
    throw new Error(`Derived table "${tableName}" column "${columnName}" must be a string`);
  }

  return value;
};

const insertJsBatch = async (
  session: SqliteSession,
  table: CompiledDerivedTable,
  rows: readonly GtfsRow[],
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  const bind: SqlBindMap = {};
  const valuesSql = rows
    .map((row, rowIndex) => {
      const placeholders = table.columnNames.map((columnName, columnIndex) => {
        const key = `v_${rowIndex}_${columnIndex}`;
        bind[key] = normalizeValue(
          table.columns[columnName],
          columnName,
          table.name,
          row[columnName] as SqlBindValue | undefined,
        );
        return `:${key}`;
      });
      return `(${placeholders.join(", ")})`;
    })
    .join(", ");

  const columnsSql = table.columnNames.map((columnName) => quoteIdentifier(columnName)).join(", ");
  await session.exec(
    `INSERT INTO ${quoteIdentifier(table.name)} (${columnsSql}) VALUES ${valuesSql};`,
    bind,
  );
};

const readSourceRows = async <
  TName extends GtfsJpV4TableName,
  TColumns extends SourceReadColumns<TName> | undefined = undefined,
>(
  session: SqliteSession,
  tableName: TName,
  options: SourceReadOptions<TName, TColumns> = {},
): Promise<Array<SourceReadRow<TName, TColumns>>> =>
  (await readTypedGtfsSourceRows(session, tableName, options)) as Array<SourceReadRow<TName, TColumns>>;

const createBuilderContext = (
  session: SqliteSession,
  runtime: Record<string, unknown>,
  emit: ImportProgressEmitter,
  tableName: string,
): {
  runtime: Record<string, unknown>;
  exec: (sql: string, bind?: SqlBindMap) => Promise<void>;
  query: <TRow extends GtfsRow = GtfsRow>(sql: string, bind?: SqlBindMap) => Promise<TRow[]>;
  readSource: <
    TName extends GtfsJpV4TableName,
    TColumns extends SourceReadColumns<TName> | undefined = undefined,
  >(
    tableName: TName,
    options?: SourceReadOptions<TName, TColumns>,
  ) => Promise<Array<SourceReadRow<TName, TColumns>>>;
  readOptionalSource: <
    TName extends GtfsJpV4TableName,
    TColumns extends SourceReadColumns<TName> | undefined = undefined,
  >(
    tableName: TName,
    options?: SourceReadOptions<TName, TColumns>,
  ) => Promise<Array<SourceReadRow<TName, TColumns>>>;
  hasSource: (tableName: GtfsJpV4TableName) => Promise<boolean>;
  emitProgress: (progress: DerivedBuilderProgress) => void;
} => ({
  runtime,
  exec: async (sql, bind = {}) => {
    await session.exec(sql, bind);
  },
  query: async <TRow extends GtfsRow = GtfsRow>(sql: string, bind: SqlBindMap = {}) =>
    await session.execRows<TRow>(sql, bind),
  readSource: async <TName extends GtfsJpV4TableName, TColumns extends SourceReadColumns<TName> | undefined>(
    sourceTableName: TName,
    options: SourceReadOptions<TName, TColumns> = {},
  ): Promise<Array<SourceReadRow<TName, TColumns>>> => {
    if (!GTFS_SOURCE_SET.has(sourceTableName)) {
      throw new Error(`Unknown GTFS source table: ${sourceTableName}`);
    }
    if (!(await tableExists(session, sourceTableName))) {
      throw new Error(`Required GTFS source table is missing: ${sourceTableName}`);
    }
    return await readSourceRows(session, sourceTableName, options);
  },
  readOptionalSource: async <
    TName extends GtfsJpV4TableName,
    TColumns extends SourceReadColumns<TName> | undefined,
  >(
    sourceTableName: TName,
    options: SourceReadOptions<TName, TColumns> = {},
  ): Promise<Array<SourceReadRow<TName, TColumns>>> => {
    if (!GTFS_SOURCE_SET.has(sourceTableName)) {
      throw new Error(`Unknown GTFS source table: ${sourceTableName}`);
    }
    if (!(await tableExists(session, sourceTableName))) {
      return [];
    }
    return await readSourceRows(session, sourceTableName, options);
  },
  hasSource: async (sourceTableName: GtfsJpV4TableName): Promise<boolean> => {
    if (!GTFS_SOURCE_SET.has(sourceTableName)) {
      throw new Error(`Unknown GTFS source table: ${sourceTableName}`);
    }
    return await tableExists(session, sourceTableName);
  },
  emitProgress: (progress) => {
    emitTargetEvent(
      emit,
      "derive",
      "derived",
      tableName,
      progress.state ?? "running",
      progress.message,
      { rowsWritten: progress.rowsWritten ?? 0 },
    );
  },
});

const tableExists = async (session: SqliteSession, tableName: string): Promise<boolean> => {
  const rows = await session.execRows<{ found: number }>(
    "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = :name LIMIT 1;",
    { name: tableName },
  );
  return rows.length > 0;
};

const ensureDeclaredColumns = async (
  session: SqliteSession,
  table: CompiledDerivedTable,
): Promise<void> => {
  const rows = await session.execRows<{ name: string }>(`PRAGMA table_info(${quoteIdentifier(table.name)});`);
  const actualColumns = new Set(rows.map((row) => row.name));
  for (const columnName of table.columnNames) {
    if (!actualColumns.has(columnName)) {
      throw new Error(`Derived table "${table.name}" is missing declared column "${columnName}"`);
    }
  }
};

const createMetadataTables = async (session: SqliteSession): Promise<void> => {
  await session.exec(
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(MATERIALIZATION_RUNS_TABLE)} (
      run_id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      source_tables_imported INTEGER NOT NULL DEFAULT 0,
      source_rows_imported INTEGER NOT NULL DEFAULT 0,
      derived_tables_materialized INTEGER NOT NULL DEFAULT 0,
      derived_rows_written INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );`,
  );

  await session.exec(
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(MATERIALIZATION_TABLES_TABLE)} (
      run_id TEXT NOT NULL,
      target_kind TEXT NOT NULL,
      table_name TEXT NOT NULL,
      status TEXT NOT NULL,
      rows_written INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      skip_reason TEXT,
      PRIMARY KEY (run_id, target_kind, table_name)
    );`,
  );
};

const insertTableMetric = async (
  session: SqliteSession,
  runId: string,
  metric: MaterializationTableMetric,
): Promise<void> => {
  await session.exec(
    `INSERT OR REPLACE INTO ${quoteIdentifier(MATERIALIZATION_TABLES_TABLE)}
      (run_id, target_kind, table_name, status, rows_written, error, skip_reason)
      VALUES (:run_id, :target_kind, :table_name, :status, :rows_written, :error, :skip_reason);`,
    {
      run_id: runId,
      target_kind: metric.targetKind,
      table_name: metric.tableName,
      status: metric.state,
      rows_written: metric.rowsWritten,
      error: metric.error ?? null,
      skip_reason: metric.skipReason ?? null,
    },
  );
};

export const runDerivedMaterialization = async ({
  session,
  compiledSchema,
  runtime,
  emit,
  sourceMetrics,
}: DerivedExecutionArgs): Promise<DerivedMaterializationResult> => {
  await createMetadataTables(session);

  const startedAt = new Date().toISOString();
  const runId = `${startedAt}-${Math.random().toString(36).slice(2, 10)}`;
  await session.exec(
    `INSERT INTO ${quoteIdentifier(MATERIALIZATION_RUNS_TABLE)}
      (run_id, started_at, status)
      VALUES (:run_id, :started_at, :status);`,
    {
      run_id: runId,
      started_at: startedAt,
      status: "running",
    },
  );

  for (const sourceMetric of sourceMetrics) {
    await insertTableMetric(session, runId, sourceMetric);
  }

  const skippedDerivedTables: string[] = [];
  const tableMetrics: MaterializationTableMetric[] = [];
  const blockedDependencies = new Map<string, string>();
  let derivedTablesMaterialized = 0;
  let derivedRowsWritten = 0;

  for (const [tableIndex, table] of compiledSchema.derivedTables.entries()) {
    const blockedDependency = table.derivedDependencies.find((dependencyName) => blockedDependencies.has(dependencyName));
    if (blockedDependency) {
      const skipReason = `dependency skipped: ${blockedDependency}`;
      emitTargetEvent(emit, "derive", "derived", table.name, "skipped", `Derived skipped: ${table.name}`);
      const metric: MaterializationTableMetric = {
        targetKind: "derived",
        tableName: table.name,
        state: "skipped",
        rowsWritten: 0,
        skipReason,
      };
      tableMetrics.push(metric);
      skippedDerivedTables.push(table.name);
      blockedDependencies.set(table.name, skipReason);
      await insertTableMetric(session, runId, metric);
      continue;
    }

    emitTargetEvent(emit, "derive", "derived", table.name, "running", `Derived started: ${table.name}`);
    const savepointName = `derived_${tableIndex}`;
    await session.exec(`SAVEPOINT ${savepointName};`);

    try {
      const context = createBuilderContext(session, runtime, emit, table.name);
      let rowsWritten = 0;

      if (table.build.kind === "sql") {
        await createDerivedTable(session, table);
        const bind = await resolveSqlBind(table.build.bind, context);
        const columnsSql = table.columnNames.map((columnName) => quoteIdentifier(columnName)).join(", ");
        await session.exec(
          `INSERT INTO ${quoteIdentifier(table.name)} (${columnsSql}) ${table.build.selectSql};`,
          bind,
        );
      } else if (table.build.kind === "sqlScript") {
        await session.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(table.name)};`);
        const statements =
          typeof table.build.statements === "function"
            ? await table.build.statements(context)
            : table.build.statements;
        for (const statement of statements) {
          await session.exec(statement);
        }
        if (!(await tableExists(session, table.name))) {
          throw new Error(`Derived sqlScript did not create table "${table.name}"`);
        }
        await ensureDeclaredColumns(session, table);
      } else {
        await createDerivedTable(session, table);
        const iterable = await table.build.run(context);
        const batchSize = Math.max(1, Math.floor(table.build.batchSize ?? 1000));
        let batch: GtfsRow[] = [];

        for await (const row of toAsyncIterable(iterable)) {
          batch.push(row);
          if (batch.length < batchSize) {
            continue;
          }
          await insertJsBatch(session, table, batch);
          rowsWritten += batch.length;
          batch = [];
        }

        if (batch.length > 0) {
          await insertJsBatch(session, table, batch);
          rowsWritten += batch.length;
        }
      }

      await createIndexes(session, table);
      rowsWritten = rowsWritten > 0 ? rowsWritten : await countRows(session, table.name);
      derivedTablesMaterialized += 1;
      derivedRowsWritten += rowsWritten;

      const metric: MaterializationTableMetric = {
        targetKind: "derived",
        tableName: table.name,
        state: "done",
        rowsWritten,
      };
      await session.exec(`RELEASE SAVEPOINT ${savepointName};`);
      tableMetrics.push(metric);
      await insertTableMetric(session, runId, metric);
      emitTargetEvent(emit, "derive", "derived", table.name, "done", `Derived done: ${table.name}`, {
        rowsWritten,
      });
    } catch (error) {
      await session.exec(`ROLLBACK TO SAVEPOINT ${savepointName};`);
      await session.exec(`RELEASE SAVEPOINT ${savepointName};`);
      const message = error instanceof Error ? error.message : String(error);

      if (table.onError === "skip") {
        const metric: MaterializationTableMetric = {
          targetKind: "derived",
          tableName: table.name,
          state: "skipped",
          rowsWritten: 0,
          error: message,
          skipReason: message,
        };
        tableMetrics.push(metric);
        skippedDerivedTables.push(table.name);
        blockedDependencies.set(table.name, message);
        await insertTableMetric(session, runId, metric);
        emitTargetEvent(emit, "derive", "derived", table.name, "skipped", `Derived skipped: ${table.name}`);
        continue;
      }

      await session.exec(
        `UPDATE ${quoteIdentifier(MATERIALIZATION_RUNS_TABLE)}
          SET finished_at = :finished_at,
              status = :status,
              error = :error
          WHERE run_id = :run_id;`,
        {
          run_id: runId,
          finished_at: new Date().toISOString(),
          status: "error",
          error: message,
        },
      );

      const metric: MaterializationTableMetric = {
        targetKind: "derived",
        tableName: table.name,
        state: "error",
        rowsWritten: 0,
        error: message,
      };
      await insertTableMetric(session, runId, metric);
      emitTargetEvent(emit, "derive", "derived", table.name, "error", `Derived failed: ${table.name}`);
      throw error;
    }
  }

  await session.exec(
    `UPDATE ${quoteIdentifier(MATERIALIZATION_RUNS_TABLE)}
      SET finished_at = :finished_at,
          status = :status,
          source_tables_imported = :source_tables_imported,
          source_rows_imported = :source_rows_imported,
          derived_tables_materialized = :derived_tables_materialized,
          derived_rows_written = :derived_rows_written,
          error = NULL
      WHERE run_id = :run_id;`,
    {
      run_id: runId,
      finished_at: new Date().toISOString(),
      status: "done",
      source_tables_imported: sourceMetrics.filter((metric) => metric.state === "done").length,
      source_rows_imported: sourceMetrics.reduce((sum, metric) => sum + metric.rowsWritten, 0),
      derived_tables_materialized: derivedTablesMaterialized,
      derived_rows_written: derivedRowsWritten,
    },
  );

  return {
    derivedTablesMaterialized,
    derivedRowsWritten,
    skippedDerivedTables,
    tableMetrics,
  };
};

export const isInternalMaterializationTable = (tableName: string): boolean =>
  tableName.startsWith(RESERVED_TABLE_PREFIX);
