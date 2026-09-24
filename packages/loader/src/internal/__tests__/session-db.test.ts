import { CompiledQuery, type QueryResult } from 'kysely';
import { describe, expect, it, vi } from 'vitest';

import { createSessionDb } from '../session-db.js';

type AbortableConnection = {
  executeQuery<R>(
    compiledQuery: CompiledQuery,
    options?: { signal?: AbortSignal },
  ): Promise<QueryResult<R>>;
};

const createFakeSession = (rows: Record<string, unknown>[]) => {
  const execRows = vi.fn(async () => rows);
  return { session: { execRows }, execRows };
};

describe('createSessionDb', () => {
  it('executes queries through the session with named parameters', async () => {
    const { session, execRows } = createFakeSession([{ agency_id: 'A1' }]);
    const db = createSessionDb(session as never);

    const rows = await db
      .selectFrom('agency')
      .select('agency_id')
      .where('agency_id', '=', 'A1')
      .execute();

    expect(rows).toEqual([{ agency_id: 'A1' }]);
    expect(execRows).toHaveBeenCalledWith(
      'select "agency_id" from "agency" where "agency_id" = :_p1',
      { _p1: 'A1' },
    );
  });

  it('streams rows in chunks', async () => {
    const { session, execRows } = createFakeSession([
      { agency_id: 'A1' },
      { agency_id: 'A2' },
      { agency_id: 'A3' },
    ]);
    const db = createSessionDb(session as never);

    const rows: unknown[] = [];
    for await (const row of db.selectFrom('agency').select('agency_id').stream(2)) {
      rows.push(row);
    }

    expect(rows).toEqual([{ agency_id: 'A1' }, { agency_id: 'A2' }, { agency_id: 'A3' }]);
    expect(execRows).toHaveBeenCalledTimes(1);
  });

  it('rejects without querying the session when the signal is already aborted', async () => {
    const { session, execRows } = createFakeSession([]);
    const db = createSessionDb(session as never);
    const controller = new AbortController();
    controller.abort();

    await expect(
      db.getExecutor().provideConnection((connection) =>
        (connection as AbortableConnection).executeQuery(CompiledQuery.raw('select 1'), {
          signal: controller.signal,
        }),
      ),
    ).rejects.toThrow();
    expect(execRows).not.toHaveBeenCalled();
  });
});
