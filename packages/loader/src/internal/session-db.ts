import type { GtfsJpV4TypedRows } from '@gtfs-jp/types';
import {
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  Kysely,
  type QueryResult,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely';

import type { SqlBindMap, SqlBindValue } from '../sql-types.js';
import { SqliteSession } from './session.js';

const toNamedParams = (
  sql: string,
  parameters: readonly unknown[],
): { sql: string; bind: SqlBindMap } => {
  let index = 0;
  const bind: SqlBindMap = {};
  const namedSql = sql.replace(/\?/g, () => {
    const key = `_p${index + 1}`;
    bind[key] = parameters[index++] as SqlBindValue;
    return `:${key}`;
  });
  return { sql: namedSql, bind };
};

// Same shape as kysely's `AbortableOperationOptions` (0.29+), which is not exported by 0.28.
type AbortableOperationOptions = {
  readonly signal?: AbortSignal;
};

class SessionConnection implements DatabaseConnection {
  constructor(private readonly session: SqliteSession) {}

  async executeQuery<R>(
    compiledQuery: CompiledQuery,
    options?: AbortableOperationOptions,
  ): Promise<QueryResult<R>> {
    options?.signal?.throwIfAborted();
    const { sql, bind } = toNamedParams(compiledQuery.sql, compiledQuery.parameters);
    const rows = (await this.session.execRows<R>(sql, bind)) as R[];
    return { rows };
  }

  // The session returns all rows at once, so rows are fetched first and then yielded in chunks.
  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    chunkSize = 1,
    options?: AbortableOperationOptions,
  ): AsyncIterableIterator<QueryResult<R>> {
    const { rows } = await this.executeQuery<R>(compiledQuery, options);
    const size = Math.max(1, Math.floor(chunkSize));
    for (let index = 0; index < rows.length; index += size) {
      yield { rows: rows.slice(index, index + size) };
    }
  }
}

class SessionDriver implements Driver {
  readonly #connection: SessionConnection;

  constructor(session: SqliteSession) {
    this.#connection = new SessionConnection(session);
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return this.#connection;
  }

  async beginTransaction(): Promise<void> {
    throw new Error('Transactions are not supported');
  }

  async commitTransaction(): Promise<void> {}

  async rollbackTransaction(): Promise<void> {}

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {}
}

export type GtfsSourceDatabase = GtfsJpV4TypedRows;

export const createSessionDb = <DB extends GtfsSourceDatabase>(
  session: SqliteSession,
): Kysely<DB> =>
  new Kysely<DB>({
    dialect: {
      createAdapter: () => new SqliteAdapter(),
      createDriver: () => new SessionDriver(session),
      createIntrospector: (db) => new SqliteIntrospector(db),
      createQueryCompiler: () => new SqliteQueryCompiler(),
    },
  });
