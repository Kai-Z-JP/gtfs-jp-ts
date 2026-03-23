import type { GtfsRow } from '@gtfs-jp/types';

import type { SqlBindMap, SqlBindValue, SqliteStorageMode } from '../types.js';
import { normalizeBind } from './sql.js';
import { createPromiser, type SqlitePromiser } from './sqlite-worker.js';
import { resolveFilename } from './storage.js';

type ExecResult<T> = {
  resultRows?: T[];
};

export class SqliteSession {
  readonly #mode: SqliteStorageMode;
  readonly #filename?: string;
  readonly #worker?: Worker;
  #promiser?: SqlitePromiser;
  #dbId?: string | number;

  constructor(options: { mode: SqliteStorageMode; filename?: string; worker?: Worker }) {
    this.#mode = options.mode;
    this.#filename = options.filename;
    this.#worker = options.worker;
  }

  get mode(): SqliteStorageMode {
    return this.#mode;
  }

  get filename(): string | undefined {
    return this.#filename;
  }

  get worker(): Worker | undefined {
    return this.#worker;
  }

  async open(): Promise<void> {
    if (this.#dbId !== undefined) {
      return;
    }

    this.#promiser = await createPromiser(this.#worker);
    const filename = resolveFilename(this.#mode, this.#filename);
    const response = await this.#promiser('open', { filename });
    const dbId =
      response.dbId ?? (response.result as Record<string, string | number> | undefined)?.dbId;

    if (dbId === undefined) {
      throw new Error('Failed to open sqlite database: dbId not returned');
    }

    this.#dbId = dbId;
  }

  async close(options: { unlink?: boolean } = {}): Promise<void> {
    if (!this.#promiser || this.#dbId === undefined) {
      return;
    }

    await this.#promiser('close', {
      dbId: this.#dbId,
      unlink: options.unlink ?? false,
    });

    this.#dbId = undefined;
  }

  async exec(sql: string, bind: SqlBindMap = {}): Promise<void> {
    this.#ensureOpen();
    await this.#promiser!('exec', {
      dbId: this.#dbId,
      sql,
      bind: normalizeBind(bind),
    });
  }

  async execRows<T extends GtfsRow>(
    sql: string,
    bind: Record<string, SqlBindValue> = {},
  ): Promise<T[]> {
    this.#ensureOpen();

    const response = await this.#promiser!('exec', {
      dbId: this.#dbId,
      sql,
      bind: normalizeBind(bind),
      rowMode: 'object',
      resultRows: [],
    });

    const result = response.result as ExecResult<T> | undefined;
    return result?.resultRows ?? [];
  }

  async exportBytes(): Promise<Uint8Array> {
    this.#ensureOpen();

    const response = await this.#promiser!('export', {
      dbId: this.#dbId,
    });

    const result = response.result as { byteArray?: unknown } | undefined;
    const byteArray = result?.byteArray;

    if (byteArray instanceof Uint8Array) {
      return byteArray;
    }

    if (byteArray instanceof ArrayBuffer) {
      return new Uint8Array(byteArray);
    }

    if (ArrayBuffer.isView(byteArray)) {
      return new Uint8Array(
        byteArray.buffer.slice(byteArray.byteOffset, byteArray.byteOffset + byteArray.byteLength),
      );
    }

    throw new Error('Worker export did not return a valid byte array');
  }

  #ensureOpen(): void {
    if (!this.#promiser || this.#dbId === undefined) {
      throw new Error('SQLite database is not opened. Call open() first.');
    }
  }
}
