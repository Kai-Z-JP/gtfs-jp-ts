import type { GtfsJpV4TableName, GtfsJpV4TableRow, GtfsRow } from '@gtfs-jp/types';

import type {
  GtfsSchemaDefinition,
  GtfsSchemaRuntime,
  GtfsSchemaTableName,
  GtfsSchemaTableRow,
  SourceReadColumns,
  SourceReadRow,
} from './schema-types.js';
import type { SqlBindMap, SqlBindValue } from './sql-types.js';

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

export interface TableReadOptions {
  limit?: number;
  offset?: number;
  orderBy?: string | readonly string[];
  columns?: readonly string[];
  where?: string;
  bind?: SqlBindMap;
}

export interface LoadGtfsTablesOptions extends TableReadOptions {
  only?: readonly GtfsJpV4TableName[];
  skipMissing?: boolean;
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

export interface ImportGtfsZipOptions {
  parseWorkerConcurrency?: number;
  dbWriteConcurrency?: number;
  parseChunkRowCount?: number;
  insertBatchRowCount?: number;
  opfsImportMode?: 'memory-stage' | 'direct';
  onProgress?: (event: ImportProgressEvent) => void;
}

export interface ImportGtfsZipResult {
  tablesImported: number;
  rowsImported: number;
  derivedTablesMaterialized: number;
  derivedRowsWritten: number;
  skippedFiles: string[];
  skippedDerivedTables: string[];
}

export interface GtfsLoader<TSchema extends GtfsSchemaDefinition = GtfsSchemaDefinition> {
  readonly mode: SqliteStorageMode;
  open(): Promise<void>;
  close(options?: CloseOptions): Promise<void>;
  reset(): Promise<void>;
  listTables(): Promise<string[]>;
  listGtfsTables(): Promise<GtfsJpV4TableName[]>;
  hasTable(tableName: string): Promise<boolean>;
  read<TName extends GtfsSchemaTableName<TSchema>>(
    tableName: TName,
    options?: TableReadOptions,
  ): Promise<Array<GtfsSchemaTableRow<TSchema, TName>>>;
  readTable<TName extends GtfsJpV4TableName>(
    tableName: TName,
    options?: TableReadOptions,
  ): Promise<Array<GtfsJpV4TableRow<TName>>>;

  readSource<
    TName extends GtfsJpV4TableName,
    TColumns extends SourceReadColumns<TName> | undefined = undefined,
  >(
    tableName: TName,
    options?: {
      limit?: number;
      orderBy?: string | readonly string[];
      columns?: TColumns;
    },
  ): Promise<Array<SourceReadRow<TName, TColumns>>>;
  readRows(tableName: string, options?: TableReadOptions): Promise<GtfsRow[]>;
  loadTables(
    options?: LoadGtfsTablesOptions,
  ): Promise<Partial<Record<GtfsJpV4TableName, GtfsRow[]>>>;
  importZip(
    file: File | Blob | ArrayBuffer | Uint8Array,
    options?: ImportGtfsZipOptions,
  ): Promise<ImportGtfsZipResult>;
  query<TRow extends GtfsRow = GtfsRow>(sql: string, bind?: SqlBindMap): Promise<TRow[]>;
  exec(sql: string, bind?: SqlBindMap): Promise<void>;
}

export type ImportProgressEmitter = (event: ImportProgressEvent) => void;

export type { SqlBindMap, SqlBindValue };
