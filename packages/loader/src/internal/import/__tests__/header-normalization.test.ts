import { describe, expect, it } from 'vitest';

import { normalizeHeaderName } from '../header-normalization.js';

describe('normalizeHeaderName', () => {
  it('normalizes imported headers to lowercase', () => {
    expect(normalizeHeaderName(' Route_ID ', 'routes.txt', 0)).toBe('route_id');
    expect(normalizeHeaderName('\uFEFFJP_Parent_Route_ID', 'routes.txt', 1)).toBe(
      'jp_parent_route_id',
    );
  });

  it('causes case-only duplicates to collide after normalization', () => {
    const headers = [
      normalizeHeaderName('Stop_ID', 'stops.txt', 0),
      normalizeHeaderName('stop_id', 'stops.txt', 1),
    ];

    expect(new Set(headers).size).toBeLessThan(headers.length);
  });

  it('rejects invalid SQL identifiers after normalization', () => {
    expect(() => normalizeHeaderName('Route-ID', 'routes.txt', 0)).toThrow(
      'routes.txt: header[0] is not a valid SQL identifier: route-id',
    );
  });
});
