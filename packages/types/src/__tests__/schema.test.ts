import { describe, expect, it } from 'vitest';

import {
  GTFS_JP_V4_SCHEMA,
  GTFS_JP_V4_TABLE_NAMES,
  getGtfsJpV4TableSchema,
  isGtfsJpV4TableName,
  resolveGtfsJpV4TableNameFromFileName,
  type GtfsJpV4TableRow,
} from '../index.js';

describe('GTFS-JP v4 schema', () => {
  it('resolves table name from file name', () => {
    expect(resolveGtfsJpV4TableNameFromFileName('routes.txt')).toBe('routes');
    expect(resolveGtfsJpV4TableNameFromFileName('ROUTES.TXT')).toBe('routes');
    expect(resolveGtfsJpV4TableNameFromFileName('agency_jp.txt')).toBe('agency_jp');
    expect(resolveGtfsJpV4TableNameFromFileName('PATTERN_JP.TXT')).toBe('pattern_jp');
    expect(resolveGtfsJpV4TableNameFromFileName('unknown.txt')).toBeUndefined();
  });

  it('keeps table name catalog synchronized with schema', () => {
    expect(GTFS_JP_V4_TABLE_NAMES.length).toBe(GTFS_JP_V4_SCHEMA.length);
    expect(GTFS_JP_V4_TABLE_NAMES.includes('routes')).toBe(true);
    expect(GTFS_JP_V4_TABLE_NAMES.includes('agency_jp')).toBe(true);
    expect(GTFS_JP_V4_TABLE_NAMES.includes('office_jp')).toBe(true);
    expect(GTFS_JP_V4_TABLE_NAMES.includes('pattern_jp')).toBe(true);
    expect(isGtfsJpV4TableName('routes')).toBe(true);
    expect(isGtfsJpV4TableName('agency_jp')).toBe(true);
    expect(isGtfsJpV4TableName('nope')).toBe(false);
  });

  it('derives required and optional columns from schema while keeping conditional metadata', () => {
    const routesSchema = getGtfsJpV4TableSchema('routes');
    expect(routesSchema.columns.route_id.required).toBe(true);
    expect(routesSchema.columns.route_type.required).toBe(true);
    expect(routesSchema.columns.route_short_name.requirement).toBe('conditional_required');
    expect(routesSchema.columns.jp_parent_route_id.requirement).toBe('optional');
    expect('required' in routesSchema.columns.route_short_name).toBe(false);

    const tripsSchema = getGtfsJpV4TableSchema('trips');
    expect(tripsSchema.columns.jp_office_id.requirement).toBe('optional');
    expect(tripsSchema.columns.shape_id.requirement).toBe('conditional_required');

    const officeSchema = getGtfsJpV4TableSchema('office_jp');
    expect(officeSchema.columns.office_id.required).toBe(true);
    expect(officeSchema.columns.office_name.required).toBe(true);

    const row: GtfsJpV4TableRow<'routes'> = {
      route_id: 'R1',
      agency_id: 'A1',
      route_type: 3,
    };
    expect(row.route_id).toBe('R1');
    expect(row.route_short_name).toBeUndefined();

    const officeRow: GtfsJpV4TableRow<'office_jp'> = {
      office_id: 'OFF001',
      office_name: 'Main Office',
    };
    expect(officeRow.office_id).toBe('OFF001');
  });
});
