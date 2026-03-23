import { describe, expect, it } from 'vitest';

import { buildServiceCalendarIndex } from '../index.js';
import type { GtfsJpV4TableRow } from '../index.js';

type CalRow = GtfsJpV4TableRow<'calendar'>;
type CdRow = GtfsJpV4TableRow<'calendar_dates'>;

const monday: CalRow = {
  service_id: 'weekday',
  monday: 1,
  tuesday: 1,
  wednesday: 1,
  thursday: 1,
  friday: 1,
  saturday: 0,
  sunday: 0,
  start_date: '20250101',
  end_date: '20251231',
};

const weekend: CalRow = {
  service_id: 'weekend',
  monday: 0,
  tuesday: 0,
  wednesday: 0,
  thursday: 0,
  friday: 0,
  saturday: 1,
  sunday: 1,
  start_date: '20250101',
  end_date: '20251231',
};

describe('buildServiceCalendarIndex', () => {
  it('returns active service for matching weekday', () => {
    const index = buildServiceCalendarIndex([monday, weekend], []);
    // 2025-04-07 is a Monday
    expect(index.isActive('weekday', '20250407')).toBe(true);
    expect(index.isActive('weekend', '20250407')).toBe(false);
  });

  it('returns active service for weekend', () => {
    const index = buildServiceCalendarIndex([monday, weekend], []);
    // 2025-04-05 is a Saturday
    expect(index.isActive('weekend', '20250405')).toBe(true);
    expect(index.isActive('weekday', '20250405')).toBe(false);
  });

  it('respects start_date / end_date range', () => {
    const limited: CalRow = { ...monday, service_id: 'limited', start_date: '20250601', end_date: '20250630' };
    const index = buildServiceCalendarIndex([limited], []);
    // Monday 2025-05-26 is before range
    expect(index.isActive('limited', '20250526')).toBe(false);
    // Monday 2025-06-02 is within range
    expect(index.isActive('limited', '20250602')).toBe(true);
    // Monday 2025-07-07 is after range
    expect(index.isActive('limited', '20250707')).toBe(false);
  });

  it('exception_type=1 adds service even on non-operating day', () => {
    const exceptions: CdRow[] = [
      { service_id: 'weekday', date: '20250405', exception_type: 1 }, // Saturday
    ];
    const index = buildServiceCalendarIndex([monday], exceptions);
    expect(index.isActive('weekday', '20250405')).toBe(true);
  });

  it('exception_type=2 removes service on normally-operating day', () => {
    const exceptions: CdRow[] = [
      { service_id: 'weekday', date: '20250407', exception_type: 2 }, // Monday
    ];
    const index = buildServiceCalendarIndex([monday], exceptions);
    expect(index.isActive('weekday', '20250407')).toBe(false);
  });

  it('accepts Date objects', () => {
    const index = buildServiceCalendarIndex([monday], []);
    expect(index.isActive('weekday', new Date(2025, 3, 7))).toBe(true); // Mon Apr 7
    expect(index.isActive('weekday', new Date(2025, 3, 5))).toBe(false); // Sat Apr 5
  });

  it('getActiveServiceIds returns correct services', () => {
    const index = buildServiceCalendarIndex([monday, weekend], []);
    // Monday 2025-04-07
    expect(index.getActiveServiceIds('20250407').sort()).toEqual(['weekday']);
    // Saturday 2025-04-05
    expect(index.getActiveServiceIds('20250405').sort()).toEqual(['weekend']);
  });

  it('handles service only in calendar_dates with no calendar entry', () => {
    const exceptions: CdRow[] = [
      { service_id: 'special', date: '20250407', exception_type: 1 },
    ];
    const index = buildServiceCalendarIndex([], exceptions);
    expect(index.isActive('special', '20250407')).toBe(true);
    expect(index.isActive('special', '20250408')).toBe(false);
  });

  it('returns false for unknown service', () => {
    const index = buildServiceCalendarIndex([monday], []);
    expect(index.isActive('unknown', '20250407')).toBe(false);
  });
});
