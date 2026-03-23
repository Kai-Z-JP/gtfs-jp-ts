import { describe, expect, it } from 'vitest';

import {
  assertIdentifier,
  buildLimitOffsetClause,
  buildOrderByClause,
  buildSelectClause,
  normalizeBind,
  quoteIdentifier,
  toSqlLiteral,
  toTableNameFromTxtFile,
} from '../sql.js';
import { toOpfsPath } from '../storage.js';

describe('sql helpers', () => {
  it('quotes SQL identifiers safely', () => {
    expect(quoteIdentifier('routes')).toBe('"routes"');
    expect(() => assertIdentifier('routes;DROP')).toThrow();
    expect(() => quoteIdentifier('x y')).toThrow();
  });

  it('builds ORDER BY and LIMIT/OFFSET clauses', () => {
    expect(buildOrderByClause('route_id')).toBe(' ORDER BY "route_id"');
    expect(buildOrderByClause(['route_id', 'route_type'])).toBe(
      ' ORDER BY "route_id", "route_type"',
    );
    expect(buildSelectClause()).toBe('SELECT *');
    expect(buildSelectClause(['route_id', 'route_type'])).toBe('SELECT "route_id", "route_type"');

    expect(buildLimitOffsetClause({})).toEqual({ clause: '', bind: {} });
    expect(buildLimitOffsetClause({ limit: 50, offset: 10 })).toEqual({
      clause: ' LIMIT :limit OFFSET :offset',
      bind: { limit: 50, offset: 10 },
    });
    expect(buildLimitOffsetClause({ offset: 5 })).toEqual({
      clause: ' LIMIT -1 OFFSET :offset',
      bind: { offset: 5 },
    });
    expect(() => buildLimitOffsetClause({ limit: -1 })).toThrow();
    expect(() => buildSelectClause(['route_id', 'x y'])).toThrow();
  });

  it('normalizes bind keys and SQL literals', () => {
    expect(normalizeBind({ limit: 10, ':offset': 5 })).toEqual({
      ':limit': 10,
      ':offset': 5,
    });

    expect(toSqlLiteral(undefined)).toBe('NULL');
    expect(toSqlLiteral('')).toBe('NULL');
    expect(toSqlLiteral("O'Hare")).toBe("'O''Hare'");
  });

  it('extracts table names from txt files', () => {
    expect(toTableNameFromTxtFile('routes.txt')).toBe('routes');
    expect(toTableNameFromTxtFile('routes.csv')).toBeUndefined();
    expect(toTableNameFromTxtFile('1routes.txt')).toBeUndefined();
  });
});

describe('opfs helpers', () => {
  it('converts file URI to OPFS path', () => {
    expect(toOpfsPath('file:gtfs.sqlite3?vfs=opfs')).toBe('gtfs.sqlite3');
    expect(toOpfsPath('file:sub%20dir/gtfs.sqlite3?vfs=opfs')).toBe('sub dir/gtfs.sqlite3');
    expect(() => toOpfsPath('gtfs.sqlite3')).toThrow();
  });
});
