import {
  createGtfsLoader,
  type GtfsLoader,
  type SqliteStorageMode,
  type ImportProgressEvent,
  type ImportGtfsZipResult,
} from "@hyperload/gtfs-jp-v4-sql-load";
import { isGtfsJpV4TableName, type GtfsRow } from "@hyperload/gtfs-jp-v4-struct";

import type { GtfsLoaderPort } from "./GtfsLoaderPort";

type GtfsLoaderAdapterOptions = {
  storage: SqliteStorageMode;
  filename: string;
};

export class GtfsLoaderAdapter implements GtfsLoaderPort {
  private loader: GtfsLoader | undefined;

  constructor(private readonly options: GtfsLoaderAdapterOptions) {}

  async open(): Promise<void> {
    if (this.loader) {
      return;
    }

    this.loader = createGtfsLoader({
      storage: this.options.storage,
      filename: this.options.filename,
    });
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

  async listAllTables(): Promise<string[]> {
    const loader = this.requireLoader();
    return await loader.listTables();
  }

  async importGtfsZip(file: File, onProgress: (event: ImportProgressEvent) => void): Promise<ImportGtfsZipResult> {
    const loader = this.requireLoader();
    return await loader.importZip(file, { onProgress });
  }

  async readRows(tableName: string, limit: number): Promise<GtfsRow[]> {
    const loader = this.requireLoader();

    if (isGtfsJpV4TableName(tableName)) {
      return await loader.readTable(tableName, { limit });
    }

    return await loader.readRows(tableName, { limit });
  }

  private requireLoader(): GtfsLoader {
    if (!this.loader) {
      throw new Error("Loader is not open");
    }

    return this.loader;
  }
}
