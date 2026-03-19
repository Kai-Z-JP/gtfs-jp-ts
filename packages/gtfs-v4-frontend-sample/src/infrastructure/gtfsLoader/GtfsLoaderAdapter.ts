import {
  createGtfsV4SqliteLoader,
  type GtfsV4SqliteLoader,
  type SqliteStorageMode,
  type ImportProgressEvent,
  type ImportGtfsZipResult,
} from "@hyperload/gtfs-v4-sql-load";
import { isGtfsV4TableName, type GtfsRow } from "@hyperload/gtfs-v4-struct";

import type { GtfsLoaderPort } from "./GtfsLoaderPort";

type GtfsLoaderAdapterOptions = {
  storage: SqliteStorageMode;
  filename: string;
};

export class GtfsLoaderAdapter implements GtfsLoaderPort {
  private loader: GtfsV4SqliteLoader | undefined;

  constructor(private readonly options: GtfsLoaderAdapterOptions) {}

  async open(): Promise<void> {
    if (this.loader) {
      return;
    }

    this.loader = await createGtfsV4SqliteLoader({
      storage: this.options.storage,
      filename: this.options.filename,
    });
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
    await loader.clearDatabase();
  }

  async listAllTables(): Promise<string[]> {
    const loader = this.requireLoader();
    return await loader.listAllTables();
  }

  async importGtfsZip(file: File, onProgress: (event: ImportProgressEvent) => void): Promise<ImportGtfsZipResult> {
    const loader = this.requireLoader();
    return await loader.importGtfsZip(file, { onProgress });
  }

  async readRows(tableName: string, limit: number): Promise<GtfsRow[]> {
    const loader = this.requireLoader();

    if (isGtfsV4TableName(tableName)) {
      return await loader.readTable(tableName, { limit });
    }

    return await loader.readUnknownTable(tableName, { limit });
  }

  private requireLoader(): GtfsV4SqliteLoader {
    if (!this.loader) {
      throw new Error("Loader is not open");
    }

    return this.loader;
  }
}
