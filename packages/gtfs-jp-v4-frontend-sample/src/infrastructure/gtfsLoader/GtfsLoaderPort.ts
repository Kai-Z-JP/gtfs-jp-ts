import type { GtfsRow } from "@hyperload/gtfs-jp-v4-struct";
import type { ImportProgressEvent, ImportGtfsZipResult } from "@hyperload/gtfs-jp-v4-sql-load";

export interface GtfsLoaderPort {
  open(): Promise<void>;
  close(): Promise<void>;
  clearDatabase(): Promise<void>;
  listAllTables(): Promise<string[]>;
  importGtfsZip(file: File, onProgress: (event: ImportProgressEvent) => void): Promise<ImportGtfsZipResult>;
  readRows(tableName: string, limit: number): Promise<GtfsRow[]>;
}
