import type { CompiledQuery, Kysely, QueryResult } from 'kysely';
import { describe, expect, it, vi } from 'vitest';

import { createGtfsLoader } from '../../loader.js';
import type { GtfsDatabaseProvider } from '../../types.js';

type QueryRecord = {
  sql: string;
  parameters: readonly unknown[];
};

const createFakeProvider = (): {
  provider: GtfsDatabaseProvider;
  queries: QueryRecord[];
  db: Kysely<never>;
} => {
  const queries: QueryRecord[] = [];
  const db = {
    executeQuery: async <R>(query: CompiledQuery<R>): Promise<QueryResult<R>> => {
      queries.push({
        sql: query.sql,
        parameters: query.parameters,
      });
      return { rows: [{ found: 1 }] as R[] };
    },
  } as unknown as Kysely<never>;

  return {
    queries,
    db,
    provider: {
      open: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      reset: vi.fn(async () => {}),
      db: () => db,
      exportBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
      importBytes: vi.fn(async () => {}),
    } as unknown as GtfsDatabaseProvider,
  };
};

describe('custom database provider', () => {
  it('delegates lifecycle and executes loader SQL through provider db', async () => {
    const { provider, queries, db } = createFakeProvider();
    const loader = createGtfsLoader({ database: provider });

    expect(loader.db()).toBe(db);

    await loader.open();
    expect(provider.open).toHaveBeenCalledTimes(1);

    await expect(loader.hasTable('routes')).resolves.toBe(true);
    expect(queries).toEqual([
      {
        sql: "SELECT 1 as found FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        parameters: ['routes'],
      },
    ]);

    await loader.close({ unlink: true });
    expect(provider.close).toHaveBeenCalledWith({ unlink: true });

    await loader.reset();
    expect(provider.reset).toHaveBeenCalledTimes(1);

    await expect(loader.exportBytes()).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(provider.exportBytes).toHaveBeenCalledTimes(1);
  });
});
