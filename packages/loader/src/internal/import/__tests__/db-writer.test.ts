import { describe, expect, it } from 'vitest';

import { type TableWriteState, writeTableChunk } from '../db-writer.js';

describe('writeTableChunk', () => {
  it('adds missing non-required GTFS-JP columns as NULL-backed columns', async () => {
    const execCalls: string[] = [];
    const session = {
      exec: async (sql: string) => {
        execCalls.push(sql);
      },
    };

    const stateByTable = new Map<string, TableWriteState>();

    await writeTableChunk(
      session as never,
      stateByTable,
      {
        fileName: 'routes.txt',
        tableName: 'routes',
        headers: ['route_id', 'agency_id', 'route_type'],
        rows: [['R1', 'A1', '3']],
        isFirst: true,
        isLast: false,
      },
      100,
    );

    expect(execCalls[0]).toBe('DROP TABLE IF EXISTS "routes";');
    expect(execCalls[1]).toContain('"route_id" TEXT');
    expect(execCalls[1]).toContain('"route_type" REAL');
    expect(execCalls[1]).toContain('"route_short_name" TEXT');
    expect(execCalls[1]).toContain('"route_sort_order" REAL');
    expect(execCalls[1]).toContain('"jp_parent_route_id" TEXT');

    expect(execCalls[2]).toContain(
      'INSERT INTO "routes" ("route_id", "agency_id", "route_type", "route_short_name"',
    );
    expect(execCalls[2]).toContain("'R1', 'A1', '3', NULL");
  });

  it('keeps non-GTFS tables unchanged in non-strict imports', async () => {
    const execCalls: string[] = [];
    const session = {
      exec: async (sql: string) => {
        execCalls.push(sql);
      },
    };

    const stateByTable = new Map<string, TableWriteState>();

    await writeTableChunk(
      session as never,
      stateByTable,
      {
        fileName: 'custom_table.txt',
        tableName: 'custom_table',
        headers: ['id', 'name'],
        rows: [['1', 'Custom']],
        isFirst: true,
        isLast: false,
      },
      100,
    );

    expect(execCalls[0]).toBe('DROP TABLE IF EXISTS "custom_table";');
    expect(execCalls[1]).toBe('CREATE TABLE "custom_table" ("id" TEXT, "name" TEXT);');
    expect(execCalls[2]).toBe(`INSERT INTO "custom_table" ("id", "name") VALUES ('1', 'Custom');`);
  });
});
