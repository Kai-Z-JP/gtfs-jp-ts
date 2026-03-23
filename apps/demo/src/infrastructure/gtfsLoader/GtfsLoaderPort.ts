import type { GtfsRow, GtfsJpV4TableName, GtfsJpV4TableRow } from '@gtfs-jp/types';
import type {
  ImportProgressEvent,
  ImportGtfsZipResult,
  GtfsValidationResult,
  CountOptions,
} from '@gtfs-jp/loader';

export type { GtfsValidationResult, CountOptions };

export interface GtfsLoaderPort {
  open(): Promise<void>;

  close(): Promise<void>;

  clearDatabase(): Promise<void>;

  setDerivedTablesEnabled(enabled: boolean): void;

  listAllTables(): Promise<string[]>;

  importGtfsZip(
    file: File,
    onProgress: (event: ImportProgressEvent) => void,
  ): Promise<ImportGtfsZipResult>;

  readRows(tableName: string, limit: number): Promise<GtfsRow[]>;

  readTable<TName extends GtfsJpV4TableName>(
    tableName: TName,
  ): Promise<GtfsJpV4TableRow<TName>[]>;

  validate(): Promise<GtfsValidationResult>;

  count(tableName: string, options?: CountOptions): Promise<number>;

  query(sql: string): Promise<GtfsRow[]>;
}
