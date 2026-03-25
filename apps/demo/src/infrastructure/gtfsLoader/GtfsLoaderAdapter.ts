import {
  createGtfsLoader,
  type GtfsLoader,
  type GtfsValidationResult,
  type ImportGtfsZipResult,
  type ImportProgressEvent,
  type SqliteStorageMode,
} from '@gtfs-jp/loader';
import { type GtfsDatabase } from '@gtfs-jp/loader/kysely';
import type { Kysely } from 'kysely';

import type { GtfsLoaderPort } from './GtfsLoaderPort';
import { createSampleSchema, sampleRuntime } from './schema';

type GtfsLoaderAdapterOptions = {
  storage: SqliteStorageMode;
  filename: string;
};

export class GtfsLoaderAdapter implements GtfsLoaderPort {
  private loader: GtfsLoader | undefined;
  private kyselyDb: Kysely<GtfsDatabase> | undefined;
  private desiredDerivedTablesEnabled = true;
  private currentDerivedTablesEnabled = true;

  constructor(private readonly options: GtfsLoaderAdapterOptions) {}

  async open(): Promise<void> {
    if (this.loader) {
      return;
    }

    this.loader = this.createLoader(this.desiredDerivedTablesEnabled);
    this.currentDerivedTablesEnabled = this.desiredDerivedTablesEnabled;
    await this.loader.open();
  }

  async close(): Promise<void> {
    if (!this.loader) {
      return;
    }

    await this.loader.close();
    this.loader = undefined;
    this.kyselyDb = undefined;
  }

  async clearDatabase(): Promise<void> {
    const loader = this.requireLoader();
    await loader.reset();
  }

  setDerivedTablesEnabled(enabled: boolean): void {
    this.desiredDerivedTablesEnabled = enabled;
  }

  async listAllTables(): Promise<string[]> {
    const loader = this.requireLoader();
    return await loader.listTables();
  }

  async importGtfsZip(
    file: File,
    onProgress: (event: ImportProgressEvent) => void,
  ): Promise<ImportGtfsZipResult> {
    await this.recreateLoaderIfNeeded();
    const loader = this.requireLoader();
    return await loader.importZip(file, { onProgress });
  }

  async validate(): Promise<GtfsValidationResult> {
    const loader = this.requireLoader();
    return await loader.validate();
  }

  getKyselyDb(): Kysely<GtfsDatabase> {
    const loader = this.requireLoader();
    this.kyselyDb ??= loader.db();
    return this.kyselyDb;
  }

  private requireLoader(): GtfsLoader {
    if (!this.loader) {
      throw new Error('Loader is not open');
    }

    return this.loader;
  }

  private createLoader(includeDerivedTables: boolean) {
    return createGtfsLoader({
      storage: this.options.storage,
      filename: this.options.filename,
      schema: createSampleSchema(includeDerivedTables),
      runtime: sampleRuntime,
    });
  }

  private async recreateLoaderIfNeeded(): Promise<void> {
    if (!this.loader || this.currentDerivedTablesEnabled === this.desiredDerivedTablesEnabled) {
      return;
    }

    await this.loader.close();
    this.loader = this.createLoader(this.desiredDerivedTablesEnabled);
    this.kyselyDb = undefined;
    this.currentDerivedTablesEnabled = this.desiredDerivedTablesEnabled;
    await this.loader.open();
  }
}
