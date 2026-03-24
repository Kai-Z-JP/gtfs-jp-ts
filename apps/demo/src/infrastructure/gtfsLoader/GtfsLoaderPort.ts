import type { GtfsJpV4TableName, GtfsJpV4TableRow, GtfsRow } from '@gtfs-jp/types';
import type {
  CountOptions,
  GtfsValidationResult,
  ImportGtfsZipResult,
  ImportProgressEvent,
  SourceReadColumns,
  SourceReadRow,
} from '@gtfs-jp/loader';

export type { GtfsValidationResult, CountOptions, SourceReadColumns, SourceReadRow };

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

  readTable<TName extends GtfsJpV4TableName>(tableName: TName): Promise<GtfsJpV4TableRow<TName>[]>;

  readTable<TName extends GtfsJpV4TableName, TColumns extends SourceReadColumns<TName>>(
    tableName: TName,
    options: { columns: TColumns },
  ): Promise<Array<SourceReadRow<TName, TColumns>>>;

  validate(): Promise<GtfsValidationResult>;

  count(tableName: string, options?: CountOptions): Promise<number>;

  query(sql: string): Promise<GtfsRow[]>;
}
