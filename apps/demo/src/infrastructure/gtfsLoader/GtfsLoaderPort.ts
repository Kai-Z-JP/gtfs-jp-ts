import type {GtfsRow} from "@gtfs-jp/types";
import type {ImportProgressEvent, ImportGtfsZipResult} from "@gtfs-jp/loader";

export interface GtfsLoaderPort {
  open(): Promise<void>;

  close(): Promise<void>;

  clearDatabase(): Promise<void>;

  setDerivedTablesEnabled(enabled: boolean): void;

  listAllTables(): Promise<string[]>;

  importGtfsZip(file: File, onProgress: (event: ImportProgressEvent) => void): Promise<ImportGtfsZipResult>;

  readRows(tableName: string, limit: number): Promise<GtfsRow[]>;
}
