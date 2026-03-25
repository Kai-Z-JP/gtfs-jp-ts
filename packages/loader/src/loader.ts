import {
  GTFS_JP_V4_SCHEMA,
  GTFS_JP_V4_TABLE_NAMES,
  type GtfsJpV4TableName,
  isGtfsJpV4TableName,
} from '@gtfs-jp/types';
import type { Kysely } from 'kysely';

import type { GtfsSchemaDefinition, GtfsSchemaRuntime } from './schema-types.js';
import type {
  GtfsLoader,
  GtfsLoaderOptions,
  GtfsValidationResult,
  ImportGtfsZipOptions,
  ImportGtfsZipResult,
  SqliteStorageMode,
} from './types.js';
import { importZipViaMemoryStage } from './internal/import/import-memory-stage.js';
import { importZipIntoSession } from './internal/import/import-pipeline.js';
import {
  compileGtfsSchema,
  isInternalMaterializationTable,
  runDerivedMaterialization,
} from './internal/materialization.js';
import { createSessionDb } from './internal/session-db.js';
import { SqliteSession } from './internal/session.js';
import { getOpfsUnavailableReason } from './internal/storage.js';
import { KyselyDatabaseFromLoader } from './kysely.js';

class GtfsLoaderImpl<
  TSchema extends GtfsSchemaDefinition = GtfsSchemaDefinition,
> implements GtfsLoader<TSchema> {
  #mode: SqliteStorageMode;
  #strictGtfsTableName: boolean;
  #session: SqliteSession;
  #compiledSchema = compileGtfsSchema(undefined);
  #runtime: GtfsSchemaRuntime<TSchema>;
  #db: Kysely<KyselyDatabaseFromLoader<TSchema>> | undefined;

  constructor(options: GtfsLoaderOptions<TSchema> = {}) {
    this.#mode = options.storage ?? 'memory';
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

  db(): Kysely<KyselyDatabaseFromLoader<TSchema>> {
    this.#db ??= createSessionDb<KyselyDatabaseFromLoader<TSchema>>(this.#session);
    return this.#db;
  }

  async open(): Promise<void> {
    if (this.#mode === 'opfs') {
      const reason = getOpfsUnavailableReason();
      if (reason) {
        throw new Error(`OPFS mode is unavailable: ${reason}`);
      }
    }

    await this.#session.open();
  }

  async close(options: { unlink?: boolean } = {}): Promise<void> {
    this.#db = undefined;
    await this.#session.close(options);
  }

  async reset(): Promise<void> {
    await this.close({ unlink: this.#mode === 'opfs' });
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

  async importZip(
    file: File | Blob | ArrayBuffer | Uint8Array,
    options: ImportGtfsZipOptions = {},
  ): Promise<ImportGtfsZipResult> {
    const emit = (event: Parameters<NonNullable<ImportGtfsZipOptions['onProgress']>>[0]): void => {
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
                targetKind: 'source' | 'derived';
                tableName: string;
                state: 'queued' | 'running' | 'done' | 'skipped' | 'error';
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
        this.#mode === 'opfs' && (options.opfsImportMode ?? 'memory-stage') === 'memory-stage'
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
        phase: 'done',
        message: `ZIP import done: ${result.tablesImported} source tables, ${result.derivedTablesMaterialized} derived tables`,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit({
        phase: 'error',
        message: `ZIP import failed: ${message}`,
      });
      throw error;
    }
  }

  async validate(): Promise<GtfsValidationResult> {
    const present = new Set(await this.listGtfsTables());
    const presentTables = GTFS_JP_V4_TABLE_NAMES.filter((name) => present.has(name));
    const missingRequired: GtfsJpV4TableName[] = [];
    const missingConditionalRequired: GtfsJpV4TableName[] = [];

    for (const entry of GTFS_JP_V4_SCHEMA) {
      if (present.has(entry.tableName)) continue;
      if (entry.requirement === 'required') {
        missingRequired.push(entry.tableName);
      } else if (entry.requirement === 'conditional_required') {
        missingConditionalRequired.push(entry.tableName);
      }
    }

    return {
      valid: missingRequired.length === 0,
      missingRequired,
      missingConditionalRequired,
      presentTables,
    };
  }
}

export const createGtfsLoader = <TSchema extends GtfsSchemaDefinition = GtfsSchemaDefinition>(
  options: GtfsLoaderOptions<TSchema> = {},
): GtfsLoader<TSchema> => {
  return new GtfsLoaderImpl(options);
};
