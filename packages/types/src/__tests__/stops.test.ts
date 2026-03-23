import { describe, expect, it } from 'vitest';

import { buildStopHierarchy } from '../index.js';
import type { StopRow } from '../index.js';

const stops: StopRow[] = [
  { stop_id: 'station_A', stop_name: 'Station A', location_type: 1 },
  { stop_id: 'platform_A1', stop_name: 'Platform 1', parent_station: 'station_A', location_type: 0 },
  { stop_id: 'platform_A2', stop_name: 'Platform 2', parent_station: 'station_A', location_type: 0 },
  { stop_id: 'stop_B', stop_name: 'Stop B', location_type: 0 },
  { stop_id: 'stop_C', stop_name: 'Stop C', parent_station: 'stop_B', location_type: 0 },
];

describe('buildStopHierarchy', () => {
  it('places parentless stops at root', () => {
    const { roots } = buildStopHierarchy(stops);
    const rootIds = roots.map((n) => n.row.stop_id).sort();
    expect(rootIds).toEqual(['station_A', 'stop_B']);
  });

  it('attaches children to their parent', () => {
    const { byId } = buildStopHierarchy(stops);
    const stationA = byId.get('station_A')!;
    expect(stationA.children.map((n) => n.row.stop_id).sort()).toEqual(['platform_A1', 'platform_A2']);
  });

  it('sets parent reference on child nodes', () => {
    const { byId } = buildStopHierarchy(stops);
    const platform = byId.get('platform_A1')!;
    expect(platform.parent?.row.stop_id).toBe('station_A');
  });

  it('root nodes have null parent', () => {
    const { byId } = buildStopHierarchy(stops);
    expect(byId.get('station_A')!.parent).toBeNull();
    expect(byId.get('stop_B')!.parent).toBeNull();
  });

  it('indexes all stops by id', () => {
    const { byId } = buildStopHierarchy(stops);
    expect(byId.size).toBe(stops.length);
    for (const stop of stops) {
      expect(byId.has(stop.stop_id)).toBe(true);
    }
  });

  it('treats unknown parent_station as root', () => {
    const orphan: StopRow[] = [{ stop_id: 'orphan', parent_station: 'nonexistent' }];
    const { roots, byId } = buildStopHierarchy(orphan);
    expect(roots.map((n) => n.row.stop_id)).toEqual(['orphan']);
    expect(byId.get('orphan')!.parent).toBeNull();
  });

  it('handles empty input', () => {
    const { roots, byId } = buildStopHierarchy([]);
    expect(roots).toEqual([]);
    expect(byId.size).toBe(0);
  });
});
