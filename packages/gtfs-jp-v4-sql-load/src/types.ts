import type { GtfsRow, GtfsJpV4TableName, GtfsJpV4TableRow } from "@hyperload/gtfs-jp-v4-struct";

export type SqliteStorageMode = "memory" | "opfs";

export interface GtfsLoaderOptions {
  storage?: SqliteStorageMode;
  filename?: string;
  worker?: Worker;
  strictGtfsTableName?: boolean;
}

export interface CloseOptions {
  unlink?: boolean;
}

export interface TableReadOptions {
  limit?: number;
  offset?: number;
  orderBy?: string | readonly string[];
}

export interface LoadGtfsTablesOptions extends TableReadOptions {
  only?: readonly GtfsJpV4TableName[];
  skipMissing?: boolean;
}

export type ImportProgressPhase =
  | "prepare"
  | "parse"
  | "write"
  | "opfs-stage"
  | "done"
  | "error";

export type ImportTableState =
  | "queued"
  | "parsing"
  | "parsed"
  | "writing"
  | "done"
  | "skipped"
  | "error";

export interface ImportProgressTarget {
  fileName: string;
  tableName: string;
}

export interface ImportProgressEvent {
  phase: ImportProgressPhase;
  message: string;
  targets?: ImportProgressTarget[];
  fileName?: string;
  tableName?: string;
  tableState?: ImportTableState;
  parsedRows?: number;
  writtenRows?: number;
  chunkIndex?: number;
  chunkRows?: number;
}

export interface ImportGtfsZipOptions {
  parseWorkerConcurrency?: number;
  dbWriteConcurrency?: number;
  parseChunkRowCount?: number;
  insertBatchRowCount?: number;
  opfsImportMode?: "memory-stage" | "direct";
  onProgress?: (event: ImportProgressEvent) => void;
}

export interface ImportGtfsZipResult {
  tablesImported: number;
  rowsImported: number;
  skippedFiles: string[];
}

export type SqlBindValue = string | number | Uint8Array | null;
export type SqlBindMap = Record<string, SqlBindValue>;

export interface GtfsLoader {
  readonly mode: SqliteStorageMode;
  open(): Promise<void>;
  close(options?: CloseOptions): Promise<void>;
  reset(): Promise<void>;
  listTables(): Promise<string[]>;
  listGtfsTables(): Promise<GtfsJpV4TableName[]>;
  hasTable(tableName: string): Promise<boolean>;
  readTable<TName extends GtfsJpV4TableName>(
    tableName: TName,
    options?: TableReadOptions,
  ): Promise<Array<GtfsJpV4TableRow<TName>>>;
  readRows(tableName: string, options?: TableReadOptions): Promise<GtfsRow[]>;
  loadTables(options?: LoadGtfsTablesOptions): Promise<Partial<Record<GtfsJpV4TableName, GtfsRow[]>>>;
  importZip(
    file: File | Blob | ArrayBuffer | Uint8Array,
    options?: ImportGtfsZipOptions,
  ): Promise<ImportGtfsZipResult>;
  exec(sql: string, bind?: SqlBindMap): Promise<void>;
}

export type ImportProgressEmitter = (event: ImportProgressEvent) => void;
