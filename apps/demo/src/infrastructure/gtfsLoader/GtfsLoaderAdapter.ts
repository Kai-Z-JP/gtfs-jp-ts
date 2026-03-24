import {
  type CountOptions,
  createGtfsLoader,
  type GtfsLoader,
  type GtfsSchemaDefinition,
  type GtfsValidationResult,
  type ImportGtfsZipResult,
  type ImportProgressEvent,
  type SqliteStorageMode,
} from '@gtfs-jp/loader';
import type { GtfsJpV4TableName, GtfsRow } from '@gtfs-jp/types';

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

  async readTable<TName extends GtfsJpV4TableName>(
    tableName: TName,
    options?: { columns?: readonly string[] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    const loader = this.requireLoader();
    return await loader.readTable(tableName, options);
  }

  async validate(): Promise<GtfsValidationResult> {
    const loader = this.requireLoader();
    return await loader.validate();
  }

  async count(tableName: string, options?: CountOptions): Promise<number> {
    const loader = this.requireLoader();
    return await loader.count(tableName, options);
  }

  async query(sql: string): Promise<GtfsRow[]> {
    const loader = this.requireLoader();
    return await loader.query(sql);
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
