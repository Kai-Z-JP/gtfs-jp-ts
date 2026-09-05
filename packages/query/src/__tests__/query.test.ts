import { describe, expect, it } from 'vitest';

import { getActiveServiceIds, getStopTimetableDetail } from '../index.js';
import { createFakeQuerySource } from './fakeQuerySource.test-helpers.js';

const baseTables = {
  routes: [
    {
      route_id: 'R1',
      route_short_name: '1',
      route_long_name: 'Main',
      route_color: '112233',
      route_type: 3,
    },
    {
      route_id: 'R2',
      route_short_name: '2',
      route_long_name: 'Branch',
      route_color: null,
      route_type: 3,
    },
  ],
  trips: [
    {
      route_id: 'R1',
      service_id: 'WK',
      trip_id: 'T1',
      trip_headsign: 'Central',
      direction_id: 0,
    },
    {
      route_id: 'R1',
      service_id: 'WK',
      trip_id: 'T2',
      trip_headsign: 'Depot',
      direction_id: 1,
    },
    {
      route_id: 'R2',
      service_id: 'WK',
      trip_id: 'T3',
      trip_headsign: 'Harbor',
      direction_id: 0,
    },
    {
      route_id: 'R1',
      service_id: 'EXTRA',
      trip_id: 'T4',
      trip_headsign: 'Special',
      direction_id: 0,
    },
  ],
  stop_times: [
    {
      trip_id: 'T1',
      arrival_time: '08:00:00',
      departure_time: '08:00:00',
      stop_id: 'STOP_A',
      stop_sequence: 1,
    },
    {
      trip_id: 'T2',
      arrival_time: '09:00:00',
      departure_time: '09:00:00',
      stop_id: 'STOP_B',
      stop_sequence: 1,
    },
    {
      trip_id: 'T3',
      arrival_time: '10:00:00',
      departure_time: '10:00:00',
      stop_id: 'STOP_A',
      stop_sequence: 1,
    },
    {
      trip_id: 'T4',
      arrival_time: '07:00:00',
      departure_time: '07:00:00',
      stop_id: 'STOP_C',
      stop_sequence: 1,
    },
  ],
  stops: [
    {
      stop_id: 'STOP_PARENT',
      stop_code: 'PARENT',
      stop_name: 'Main Terminal',
      stop_desc: 'Main terminal stop',
      stop_lat: 35.0,
      stop_lon: 139.0,
      stop_url: null,
      location_type: 1,
      parent_station: null,
      stop_timezone: 'Asia/Tokyo',
      wheelchair_boarding: 1,
      platform_code: null,
    },
    {
      stop_id: 'STOP_A',
      stop_code: 'A',
      stop_name: 'Main Terminal Bay A',
      stop_desc: null,
      stop_lat: 35.0001,
      stop_lon: 139.0001,
      stop_url: null,
      location_type: 0,
      parent_station: 'STOP_PARENT',
      stop_timezone: 'Asia/Tokyo',
      wheelchair_boarding: 1,
      platform_code: '1',
    },
    {
      stop_id: 'STOP_B',
      stop_code: 'B',
      stop_name: 'Main Terminal Bay B',
      stop_desc: null,
      stop_lat: 35.0002,
      stop_lon: 139.0002,
      stop_url: null,
      location_type: 0,
      parent_station: 'STOP_PARENT',
      stop_timezone: 'Asia/Tokyo',
      wheelchair_boarding: 1,
      platform_code: '2',
    },
    {
      stop_id: 'STOP_C',
      stop_code: 'C',
      stop_name: 'Standalone Pole',
      stop_desc: null,
      stop_lat: 35.0003,
      stop_lon: 139.0003,
      stop_url: 'https://example.com/stop-c',
      location_type: 0,
      parent_station: null,
      stop_timezone: 'Asia/Tokyo',
      wheelchair_boarding: 0,
      platform_code: '3',
    },
  ],
  calendar: [
    {
      service_id: 'WK',
      monday: 1,
      tuesday: 1,
      wednesday: 1,
      thursday: 1,
      friday: 1,
      saturday: 0,
      sunday: 0,
      start_date: '20250401',
      end_date: '20250430',
    },
  ],
  calendar_dates: [
    {
      service_id: 'EXTRA',
      date: '20250413',
      exception_type: 1,
    },
  ],
};

describe('@gtfs-jp/query', () => {
  it('resolves active service_ids from calendar and calendar_dates', async () => {
    const result = await getActiveServiceIds(createFakeQuerySource(baseTables), '2025-04-13');

    expect([...result.serviceIds]).toEqual(['EXTRA']);
    expect(result.warnings).toEqual([]);
  });

  it('expands child poles when a parent stop is selected', async () => {
    const detail = await getStopTimetableDetail(createFakeQuerySource(baseTables), {
      stopId: 'STOP_PARENT',
      serviceDate: '2025-04-14',
    });

    expect(detail.selectedStop.stopId).toBe('STOP_PARENT');
    expect(detail.childStops.map((stop) => stop.stopId)).toEqual(['STOP_A', 'STOP_B']);
    expect(detail.timetableGroups).toHaveLength(2);
    expect(detail.timetableGroups[0]?.stop.stopId).toBe('STOP_A');
    expect(detail.timetableGroups[0]?.rows.map((row) => row.tripId)).toEqual(['T1', 'T3']);
    expect(detail.timetableGroups[1]?.stop.stopId).toBe('STOP_B');
    expect(detail.timetableGroups[1]?.rows.map((row) => row.tripId)).toEqual(['T2']);
  });

  it('returns only the selected pole when a pole is selected directly', async () => {
    const detail = await getStopTimetableDetail(createFakeQuerySource(baseTables), {
      stopId: 'STOP_A',
      serviceDate: '2025-04-14',
    });

    expect(detail.childStops).toEqual([]);
    expect(detail.timetableGroups).toHaveLength(1);
    expect(detail.timetableGroups[0]?.stop.stopId).toBe('STOP_A');
    expect(detail.timetableGroups[0]?.rows.map((row) => row.tripId)).toEqual(['T1', 'T3']);
  });

  it('filters timetable rows by routeId when provided', async () => {
    const detail = await getStopTimetableDetail(createFakeQuerySource(baseTables), {
      stopId: 'STOP_PARENT',
      serviceDate: '2025-04-14',
      routeId: 'R1',
    });

    expect(detail.timetableGroups[0]?.rows.map((row) => row.tripId)).toEqual(['T1']);
    expect(detail.timetableGroups[1]?.rows.map((row) => row.tripId)).toEqual(['T2']);
  });

  it('throws when required tables are missing', async () => {
    const source = createFakeQuerySource({
      routes: baseTables.routes,
      trips: baseTables.trips,
      stops: baseTables.stops,
      calendar: baseTables.calendar,
    });

    await expect(
      getStopTimetableDetail(source, {
        stopId: 'STOP_A',
        serviceDate: '2025-04-14',
      }),
    ).rejects.toThrow('stop_times table がありません。');
  });

  it('returns warnings and empty rows when no service runs on the date', async () => {
    const detail = await getStopTimetableDetail(createFakeQuerySource(baseTables), {
      stopId: 'STOP_C',
      serviceDate: '2025-04-20',
    });

    expect(detail.timetableGroups).toHaveLength(1);
    expect(detail.timetableGroups[0]?.rows).toEqual([]);
    expect(detail.warnings).toContain('2025-04-20 に運行する service_id が見つかりません。');
  });
});
