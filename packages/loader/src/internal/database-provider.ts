import { CompiledQuery, type Kysely } from 'kysely';

import type {
  CloseOptions,
  GtfsDatabaseProvider,
  SqlBindMap,
  SqlBindValue,
  SqliteStorageMode,
} from '../types.js';
import { normalizeBind } from './sql.js';
import { createSessionDb } from './session-db.js';
import { SqliteSession } from './session.js';

type ProviderSessionOptions = {
  mode: SqliteStorageMode;
  filename?: string;
  worker?: Worker;
};

const isIdentifierStart = (value: string | undefined): boolean =>
  value !== undefined && /[A-Za-z_]/.test(value);

const isIdentifierPart = (value: string | undefined): boolean =>
  value !== undefined && /[A-Za-z0-9_]/.test(value);

const compileNamedBindQuery = (
  sql: string,
  bind: SqlBindMap,
): { sql: string; parameters: SqlBindValue[] } => {
  const normalizedBind = normalizeBind(bind);
  const parameters: SqlBindValue[] = [];
  let compiledSql = '';
  let index = 0;
  let quote: "'" | '"' | '`' | undefined;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (quote) {
      compiledSql += char;
      if (char === quote) {
        if (next === quote) {
          compiledSql += next;
          index += 2;
          continue;
        }
        quote = undefined;
      }
      index += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      compiledSql += char;
      index += 1;
      continue;
    }

    if (char === '-' && next === '-') {
      const commentEnd = sql.indexOf('\n', index + 2);
      const endIndex = commentEnd === -1 ? sql.length : commentEnd + 1;
      compiledSql += sql.slice(index, endIndex);
      index = endIndex;
      continue;
    }

    if (char === '/' && next === '*') {
      const commentEnd = sql.indexOf('*/', index + 2);
      const endIndex = commentEnd === -1 ? sql.length : commentEnd + 2;
      compiledSql += sql.slice(index, endIndex);
      index = endIndex;
      continue;
    }

    if (char === ':' && isIdentifierStart(next)) {
      let endIndex = index + 2;
      while (isIdentifierPart(sql[endIndex])) {
        endIndex += 1;
      }

      const bindName = sql.slice(index, endIndex);
      if (Object.prototype.hasOwnProperty.call(normalizedBind, bindName)) {
        compiledSql += '?';
        parameters.push(normalizedBind[bindName]);
        index = endIndex;
        continue;
      }
    }

    compiledSql += char;
    index += 1;
  }

  return { sql: compiledSql, parameters };
};

class ProviderSession<TDB> extends SqliteSession {
  readonly #provider: GtfsDatabaseProvider<TDB>;

  constructor(provider: GtfsDatabaseProvider<TDB>, options: ProviderSessionOptions) {
    super(options);
    this.#provider = provider;
  }

  override async open(): Promise<void> {
    await this.#provider.open();
  }

  override async close(options: CloseOptions = {}): Promise<void> {
    await this.#provider.close(options);
  }

  override async reset(): Promise<void> {
    await this.#provider.reset();
  }

  override async exec(sql: string, bind: SqlBindMap = {}): Promise<void> {
    await this.execRows(sql, bind);
  }

  override async execRows<TRow>(
    sql: string,
    bind: Record<string, SqlBindValue> = {},
  ): Promise<TRow[]> {
    const compiled = compileNamedBindQuery(sql, bind);
    const result = await this.#provider
      .db()
      .executeQuery<TRow>(CompiledQuery.raw(compiled.sql, compiled.parameters));
    return result.rows as TRow[];
  }

  override async exportBytes(): Promise<Uint8Array> {
    return await this.#provider.exportBytes();
  }

  override async importBytes(bytes: Uint8Array): Promise<void> {
    await this.#provider.importBytes(bytes);
  }
}

class SqliteSessionDatabaseProvider<TDB> implements GtfsDatabaseProvider<TDB> {
  readonly #session: SqliteSession;
  #db: Kysely<TDB> | undefined;

  constructor(session: SqliteSession) {
    this.#session = session;
  }

  async open(): Promise<void> {
    await this.#session.open();
  }

  async close(options: CloseOptions = {}): Promise<void> {
    this.#db = undefined;
    await this.#session.close(options);
  }

  async reset(): Promise<void> {
    this.#db = undefined;
    await this.#session.reset();
  }

  db(): Kysely<TDB> {
    this.#db ??= createSessionDb(this.#session) as unknown as Kysely<TDB>;
    return this.#db;
  }

  async exportBytes(): Promise<Uint8Array> {
    return await this.#session.exportBytes();
  }

  async importBytes(bytes: Uint8Array): Promise<void> {
    await this.#session.importBytes(bytes);
  }
}

export const createProviderSession = <TDB>(
  provider: GtfsDatabaseProvider<TDB>,
  options: ProviderSessionOptions,
): SqliteSession => new ProviderSession(provider, options);

export const createSqliteSessionDatabaseProvider = <TDB>(
  session: SqliteSession,
): GtfsDatabaseProvider<TDB> => new SqliteSessionDatabaseProvider<TDB>(session);
