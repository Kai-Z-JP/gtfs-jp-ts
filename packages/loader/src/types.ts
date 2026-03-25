import type { GtfsJpV4TableName } from '@gtfs-jp/types';
import type { Kysely } from 'kysely';

import type { GtfsSchemaDefinition, GtfsSchemaRuntime } from './schema-types.js';
import { KyselyDatabaseFromLoader } from './kysely.js';

export type { SqlBindMap, SqlBindValue } from './sql-types.js';

export type SqliteStorageMode = 'memory' | 'opfs';

export interface GtfsLoaderOptions<TSchema extends GtfsSchemaDefinition = GtfsSchemaDefinition> {
  storage?: SqliteStorageMode;
  filename?: string;
  worker?: Worker;
  strictGtfsTableName?: boolean;
  schema?: TSchema;
  runtime?: GtfsSchemaRuntime<TSchema>;
}

export interface CloseOptions {
  unlink?: boolean;
}

export interface GtfsLoader<TSchema extends GtfsSchemaDefinition = GtfsSchemaDefinition> {
  readonly mode: SqliteStorageMode;
  open(): Promise<void>;
  close(options?: CloseOptions): Promise<void>;
  reset(): Promise<void>;
  listTables(): Promise<string[]>;
  listGtfsTables(): Promise<GtfsJpV4TableName[]>;
  hasTable(tableName: string): Promise<boolean>;
  importZip(
    file: File | Blob | ArrayBuffer | Uint8Array,
    options?: ImportGtfsZipOptions,
  ): Promise<ImportGtfsZipResult>;
  validate(): Promise<GtfsValidationResult>;
  db(): Kysely<KyselyDatabaseFromLoader<TSchema>>;
}

export interface GtfsValidationResult {
  /** true if all required tables are present */
  valid: boolean;
  missingRequired: GtfsJpV4TableName[];
  missingConditionalRequired: GtfsJpV4TableName[];
  presentTables: GtfsJpV4TableName[];
}

export type ImportProgressPhase = 'prepare' | 'import' | 'derive' | 'done' | 'error';

export type ImportTargetState = 'queued' | 'running' | 'done' | 'skipped' | 'error';

export type ImportTargetKind = 'source' | 'derived';

export interface ImportProgressTarget {
  targetKind: ImportTargetKind;
  targetName: string;
}

export interface ImportProgressEvent {
  phase: ImportProgressPhase;
  message: string;
  targetKind?: ImportTargetKind;
  targetName?: string;
  state?: ImportTargetState;
  rowsWritten?: number;
  targets?: ImportProgressTarget[];
}

export type ImportProgressEmitter = (event: ImportProgressEvent) => void;

export interface ImportGtfsZipOptions {
  parseWorkerConcurrency?: number;
  dbWriteConcurrency?: number;
  parseChunkRowCount?: number;
  insertBatchRowCount?: number;
  onProgress?: (event: ImportProgressEvent) => void;
  opfsImportMode?: 'memory-stage' | 'direct';
}

export interface ImportGtfsZipResult {
  tablesImported: number;
  rowsImported: number;
  derivedTablesMaterialized: number;
  derivedRowsWritten: number;
  skippedFiles: string[];
  skippedDerivedTables: string[];
}
