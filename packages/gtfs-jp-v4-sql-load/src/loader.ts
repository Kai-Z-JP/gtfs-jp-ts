import {
  GTFS_JP_V4_TABLE_NAMES,
  isGtfsJpV4TableName,
  type GtfsRow,
  type GtfsJpV4TableName,
  type GtfsJpV4TableRow,
} from "@hyperload/gtfs-jp-v4-struct";

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
import { importZipViaMemoryStage } from "./internal/import/import-memory-stage.js";
import { importZipIntoSession } from "./internal/import/import-pipeline.js";
import { assertIdentifier, buildLimitOffsetClause, buildOrderByClause, quoteIdentifier } from "./internal/sql.js";
import { SqliteSession } from "./internal/session.js";
import { getOpfsUnavailableReason } from "./internal/storage.js";

class GtfsLoaderImpl implements GtfsLoader {
  #mode: SqliteStorageMode;
  #strictGtfsTableName: boolean;
  #session: SqliteSession;

  constructor(options: GtfsLoaderOptions = {}) {
    this.#mode = options.storage ?? "memory";
    this.#strictGtfsTableName = options.strictGtfsTableName ?? true;
    this.#session = new SqliteSession({
      mode: this.#mode,
      filename: options.filename,
      worker: options.worker,
    });
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

    return rows.map((row) => row.name);
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

  async readTable<TName extends GtfsJpV4TableName>(
    tableName: TName,
    options: TableReadOptions = {},
  ): Promise<Array<GtfsJpV4TableRow<TName>>> {
    if (this.#strictGtfsTableName && !isGtfsJpV4TableName(tableName)) {
      throw new Error(`Unknown GTFS-JP v4 table: ${tableName}`);
    }

    const orderByClause = buildOrderByClause(options.orderBy);
    const { clause: limitOffsetClause, bind } = buildLimitOffsetClause(options);

    const sql = `SELECT * FROM ${quoteIdentifier(tableName)}${orderByClause}${limitOffsetClause}`;
    return await this.#session.execRows<GtfsJpV4TableRow<TName>>(sql, bind);
  }

  async readRows(tableName: string, options: TableReadOptions = {}): Promise<GtfsRow[]> {
    assertIdentifier(tableName);

    const orderByClause = buildOrderByClause(options.orderBy);
    const { clause: limitOffsetClause, bind } = buildLimitOffsetClause(options);

    const sql = `SELECT * FROM ${quoteIdentifier(tableName)}${orderByClause}${limitOffsetClause}`;
    return await this.#session.execRows<GtfsRow>(sql, bind);
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

    try {
      const result =
        this.#mode === "opfs" && (options.opfsImportMode ?? "memory-stage") === "memory-stage"
          ? await importZipViaMemoryStage({
              session: this.#session,
              strictGtfsTableName: this.#strictGtfsTableName,
              file,
              options,
              emit,
            })
          : await importZipIntoSession({
              session: this.#session,
              mode: this.#mode,
              strictGtfsTableName: this.#strictGtfsTableName,
              file,
              options,
              emit,
            });

      emit({
        phase: "done",
        message: `ZIP import done: ${result.tablesImported} tables, ${result.rowsImported} rows`,
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

  async exec(sql: string, bind: SqlBindMap = {}): Promise<void> {
    await this.#session.exec(sql, bind);
  }
}

export const createGtfsLoader = (options: GtfsLoaderOptions = {}): GtfsLoader => {
  return new GtfsLoaderImpl(options);
};
