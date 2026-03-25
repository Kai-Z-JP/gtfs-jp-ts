import type {
  GtfsValidationResult,
  ImportGtfsZipResult,
  ImportProgressEvent,
  SourceReadColumns,
  SourceReadRow,
} from '@gtfs-jp/loader';
import type { GtfsDatabase } from '@gtfs-jp/loader/kysely';
import type { Kysely } from 'kysely';

export type { GtfsValidationResult, SourceReadColumns, SourceReadRow, GtfsDatabase };

export interface GtfsLoaderPort<TDB extends GtfsDatabase = GtfsDatabase> {
  open(): Promise<void>;

  close(): Promise<void>;

  clearDatabase(): Promise<void>;

  setDerivedTablesEnabled(enabled: boolean): void;

  listAllTables(): Promise<string[]>;

  importGtfsZip(
    file: File,
    onProgress: (event: ImportProgressEvent) => void,
  ): Promise<ImportGtfsZipResult>;

  validate(): Promise<GtfsValidationResult>;

  getKyselyDb(): Kysely<TDB>;
}
