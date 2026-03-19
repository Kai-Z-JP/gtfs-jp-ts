import {
  GTFS_JP_V4_TABLE_NAMES,
  type GtfsJpV4TableName,
  type GtfsJpV4TableRow,
  type GtfsRow,
  isGtfsJpV4TableName,
} from "@gtfs-jp/types";

import type {
  GtfsSchemaDefinition,
  GtfsSchemaRuntime,
  GtfsSchemaTableName,
  GtfsSchemaTableRow,
  SourceReadColumns,
  SourceReadRow,
} from "./schema-types.js";
import type {
  GtfsLoader,
  GtfsLoaderOptions,
  ImportGtfsZipOptions,
  ImportGtfsZipResult,
  LoadGtfsTablesOptions,
  SqlBindMap,
  SqliteStorageMode,
  TableReadOptions,
} from "./types.js";
import {importZipViaMemoryStage} from "./internal/import/import-memory-stage.js";
import {importZipIntoSession} from "./internal/import/import-pipeline.js";
import {
  compileGtfsSchema,
  isInternalMaterializationTable,
  runDerivedMaterialization
} from "./internal/materialization.js";
import {
  assertIdentifier,
  buildLimitOffsetClause,
  buildOrderByClause,
  buildSelectClause,
  quoteIdentifier
} from "./internal/sql.js";
import {readTypedGtfsSourceRows} from "./internal/source-read.js";
import {SqliteSession} from "./internal/session.js";
import {getOpfsUnavailableReason} from "./internal/storage.js";

const readRowsFromSession = async (
  session: SqliteSession,
  tableName: string,
  options: TableReadOptions = {},
): Promise<GtfsRow[]> => {
  assertIdentifier(tableName);

  const selectClause = buildSelectClause(options.columns);
  const orderByClause = buildOrderByClause(options.orderBy);
  const {clause: limitOffsetClause, bind} = buildLimitOffsetClause(options);

  const sql = `${selectClause} FROM ${quoteIdentifier(tableName)}${orderByClause}${limitOffsetClause}`;
  return await session.execRows<GtfsRow>(sql, bind);
};

class GtfsLoaderImpl<TSchema extends GtfsSchemaDefinition = GtfsSchemaDefinition> implements GtfsLoader<TSchema> {
  #mode: SqliteStorageMode;
  #strictGtfsTableName: boolean;
  #session: SqliteSession;
  #compiledSchema = compileGtfsSchema(undefined);
  #runtime: GtfsSchemaRuntime<TSchema>;

  constructor(options: GtfsLoaderOptions<TSchema> = {}) {
    this.#mode = options.storage ?? "memory";
    this.#strictGtfsTableName = options.strictGtfsTableName ?? true;
    this.#session = new SqliteSession({
      mode: this.#mode,
      filename: options.filename,
      worker: options.worker,
    });
    this.#compiledSchema = compileGtfsSchema(options.schema);
    this.#runtime = (options.runtime ?? {}) as GtfsSchemaRuntime<TSchema>;
  }

  get mode(): SqliteStorageMode {
    return this.#mode;
  }

  async open(): Promise<void> {
    if (this.#mode === "opfs") {
      const reason = getOpfsUnavailableReason();
      if (reason) {
        throw new Error(`OPFS mode is unavailable: ${reason}`);
      }
    }

    await this.#session.open();
  }

  async close(options: { unlink?: boolean } = {}): Promise<void> {
    await this.#session.close(options);
  }

  async reset(): Promise<void> {
    await this.close({ unlink: this.#mode === "opfs" });
    await this.open();
  }

  async listTables(): Promise<string[]> {
    const rows = await this.#session.execRows<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );

    return rows
      .map((row) => row.name)
      .filter((tableName) => !isInternalMaterializationTable(tableName));
  }

  async listGtfsTables(): Promise<GtfsJpV4TableName[]> {
    const names = await this.listTables();
    return names.filter(isGtfsJpV4TableName);
  }

  async hasTable(tableName: string): Promise<boolean> {
    const rows = await this.#session.execRows<{ found: number }>(
      "SELECT 1 as found FROM sqlite_master WHERE type = 'table' AND name = :name LIMIT 1",
      { name: tableName },
    );

    return rows.length > 0;
  }

  async read<TName extends GtfsSchemaTableName<TSchema>>(
    tableName: TName,
    options: TableReadOptions = {},
  ): Promise<Array<GtfsSchemaTableRow<TSchema, TName>>> {
    return (await this.readRows(tableName, options)) as Array<GtfsSchemaTableRow<TSchema, TName>>;
  }

  async readTable<TName extends GtfsJpV4TableName>(
    tableName: TName,
    options: TableReadOptions = {},
  ): Promise<Array<GtfsJpV4TableRow<TName>>> {
    if (this.#strictGtfsTableName && !isGtfsJpV4TableName(tableName)) {
      throw new Error(`Unknown GTFS-JP v4 table: ${tableName}`);
    }

    return (await this.readRows(tableName, options)) as Array<GtfsJpV4TableRow<TName>>;
  }

  async readSource<
    TName extends GtfsJpV4TableName,
    TColumns extends SourceReadColumns<TName> | undefined = undefined,
  >(
    tableName: TName,
    options: {
      limit?: number;
      orderBy?: string | readonly string[];
      columns?: TColumns;
    } = {},
  ): Promise<Array<SourceReadRow<TName, TColumns>>> {
    if (!isGtfsJpV4TableName(tableName)) {
      throw new Error(`Unknown GTFS-JP v4 table: ${tableName}`);
    }

    return (await readTypedGtfsSourceRows(this.#session, tableName, options)) as Array<SourceReadRow<TName, TColumns>>;
  }

  async readRows(tableName: string, options: TableReadOptions = {}): Promise<GtfsRow[]> {
    return await readRowsFromSession(this.#session, tableName, options);
  }

  async loadTables(
    options: LoadGtfsTablesOptions = {},
  ): Promise<Partial<Record<GtfsJpV4TableName, GtfsRow[]>>> {
    const targetTables = options.only ?? GTFS_JP_V4_TABLE_NAMES;
    const existing = new Set(await this.listTables());
    const output: Partial<Record<GtfsJpV4TableName, GtfsRow[]>> = {};

    for (const table of targetTables) {
      if (!existing.has(table)) {
        if (options.skipMissing ?? true) {
          continue;
        }
        throw new Error(`Table does not exist: ${table}`);
      }

      output[table] = await this.readTable(table, options);
    }

    return output;
  }

  async importZip(
    file: File | Blob | ArrayBuffer | Uint8Array,
    options: ImportGtfsZipOptions = {},
  ): Promise<ImportGtfsZipResult> {
    const emit = (event: Parameters<NonNullable<ImportGtfsZipOptions["onProgress"]>>[0]): void => {
      options.onProgress?.(event);
    };

    const afterImport =
      this.#compiledSchema.derivedTables.length === 0
        ? undefined
        : async ({
            session,
            emit: derivedEmit,
            metrics,
          }: {
            session: SqliteSession;
            emit: typeof emit;
            metrics: {
              tablesImported: number;
              rowsImported: number;
              sourceTables: readonly {
                targetKind: "source" | "derived";
                tableName: string;
                state: "queued" | "running" | "done" | "skipped" | "error";
                rowsWritten: number;
                error?: string;
                skipReason?: string;
              }[];
            };
          }) =>
            await runDerivedMaterialization({
              session,
              compiledSchema: this.#compiledSchema,
              runtime: this.#runtime as Record<string, unknown>,
              emit: derivedEmit,
              sourceMetrics: metrics.sourceTables,
            });

    try {
      const result =
        this.#mode === "opfs" && (options.opfsImportMode ?? "memory-stage") === "memory-stage"
          ? await importZipViaMemoryStage({
              session: this.#session,
              strictGtfsTableName: this.#strictGtfsTableName,
              file,
              options,
              emit,
              derivedTargetNames: this.#compiledSchema.derivedTableNames,
              afterImport,
            })
          : await importZipIntoSession({
              session: this.#session,
              mode: this.#mode,
              strictGtfsTableName: this.#strictGtfsTableName,
              file,
              options,
              emit,
              derivedTargetNames: this.#compiledSchema.derivedTableNames,
              afterImport,
            });

      emit({
        phase: "done",
        message: `ZIP import done: ${result.tablesImported} source tables, ${result.derivedTablesMaterialized} derived tables`,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit({
        phase: "error",
        message: `ZIP import failed: ${message}`,
      });
      throw error;
    }
  }

  async query<TRow extends GtfsRow = GtfsRow>(sql: string, bind: SqlBindMap = {}): Promise<TRow[]> {
    return await this.#session.execRows<TRow>(sql, bind);
  }

  async exec(sql: string, bind: SqlBindMap = {}): Promise<void> {
    await this.#session.exec(sql, bind);
  }
}

export const createGtfsLoader = <TSchema extends GtfsSchemaDefinition = GtfsSchemaDefinition>(
  options: GtfsLoaderOptions<TSchema> = {},
): GtfsLoader<TSchema> => {
  return new GtfsLoaderImpl(options);
};
