import {
  createGtfsLoader,
  type GtfsLoader,
  type GtfsSchemaDefinition,
  type ImportProgressEvent,
  type ImportGtfsZipResult,
  type SqliteStorageMode,
} from '@gtfs-jp/loader';
import type { GtfsRow } from '@gtfs-jp/types';

import type { GtfsLoaderPort } from './GtfsLoaderPort';
import { createSampleSchema, sampleRuntime } from './schema';

type GtfsLoaderAdapterOptions = {
  storage: SqliteStorageMode;
  filename: string;
};

export class GtfsLoaderAdapter implements GtfsLoaderPort {
  private loader: GtfsLoader<GtfsSchemaDefinition> | undefined;
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

  async readRows(tableName: string, limit: number): Promise<GtfsRow[]> {
    const loader = this.requireLoader();
    return await loader.readRows(tableName, { limit });
  }

  private requireLoader(): GtfsLoader<GtfsSchemaDefinition> {
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
    this.currentDerivedTablesEnabled = this.desiredDerivedTablesEnabled;
    await this.loader.open();
  }
}
