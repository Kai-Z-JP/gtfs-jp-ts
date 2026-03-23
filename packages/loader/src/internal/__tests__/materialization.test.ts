import { describe, expect, it } from 'vitest';

import { defineGtfsSchema, derivedTable } from '../../schema.js';
import { compileGtfsSchema, isInternalMaterializationTable } from '../materialization.js';

describe('materialization compiler', () => {
  it('sorts derived tables by dependency order', () => {
    const schema = defineGtfsSchema({
      derivedTables: [
        derivedTable({
          name: 'service_dates',
          dependsOn: ['universal_calendar'],
          columns: {
            service_id: { kind: 'string', nullable: false },
            date: { kind: 'number', nullable: false },
          },
          build: {
            kind: 'sql',
            selectSql: 'SELECT service_id, date FROM "universal_calendar"',
          },
        }),
        derivedTable({
          name: 'universal_calendar',
          dependsOn: ['calendar', 'calendar_dates', 'feed_info'],
          columns: {
            service_id: { kind: 'string', nullable: false },
            date: { kind: 'number', nullable: false },
          },
          build: {
            kind: 'sql',
            selectSql: 'SELECT service_id, CAST(date AS INTEGER) AS date FROM "calendar_dates"',
          },
        }),
      ],
    });

    const compiled = compileGtfsSchema(schema);
    expect(compiled.derivedTableNames).toEqual(['service_dates', 'universal_calendar']);
    expect(compiled.derivedTables.map((table) => table.name)).toEqual([
      'universal_calendar',
      'service_dates',
    ]);
  });

  it('rejects unknown dependencies', () => {
    const schema = defineGtfsSchema({
      derivedTables: [
        derivedTable({
          name: 'broken',
          dependsOn: ['missing_table'],
          columns: {
            id: { kind: 'string', nullable: false },
          },
          build: {
            kind: 'sql',
            selectSql: 'SELECT "id" FROM "missing_table"',
          },
        }),
      ],
    });

    expect(() => compileGtfsSchema(schema)).toThrow('depends on unknown table "missing_table"');
  });

  it('rejects dependency cycles', () => {
    const schema = defineGtfsSchema({
      derivedTables: [
        derivedTable({
          name: 'a_table',
          dependsOn: ['b_table'],
          columns: {
            id: { kind: 'string', nullable: false },
          },
          build: {
            kind: 'sql',
            selectSql: 'SELECT "trip_id" AS id FROM "trips"',
          },
        }),
        derivedTable({
          name: 'b_table',
          dependsOn: ['a_table'],
          columns: {
            id: { kind: 'string', nullable: false },
          },
          build: {
            kind: 'sql',
            selectSql: 'SELECT "trip_id" AS id FROM "trips"',
          },
        }),
      ],
    });

    expect(() => compileGtfsSchema(schema)).toThrow('dependencies contain a cycle');
  });

  it('marks metadata tables as internal', () => {
    expect(isInternalMaterializationTable('_materialization_runs')).toBe(true);
    expect(isInternalMaterializationTable('_materialization_tables')).toBe(true);
    expect(isInternalMaterializationTable('routes')).toBe(false);
  });
});
