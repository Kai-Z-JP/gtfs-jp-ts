import { describe, expect, it } from 'vitest';

import {
  gtfsDateToIsoString,
  gtfsTimeToSeconds,
  isValidGtfsDate,
  isValidGtfsTime,
  parseGtfsDate,
  parseGtfsTime,
  secondsToGtfsTime,
  toGtfsDate,
} from '../index.js';

describe('GtfsTime utilities', () => {
  it('validates GTFS time strings', () => {
    expect(isValidGtfsTime('08:30:00')).toBe(true);
    expect(isValidGtfsTime('25:30:00')).toBe(true);
    expect(isValidGtfsTime('00:00:00')).toBe(true);
    expect(isValidGtfsTime('8:30:00')).toBe(true);
    expect(isValidGtfsTime('08:60:00')).toBe(false);
    expect(isValidGtfsTime('08:30')).toBe(false);
    expect(isValidGtfsTime('')).toBe(false);
  });

  it('parses GTFS time strings', () => {
    expect(parseGtfsTime('08:30:00')).toEqual({ hours: 8, minutes: 30, seconds: 0 });
    expect(parseGtfsTime('25:01:30')).toEqual({ hours: 25, minutes: 1, seconds: 30 });
    expect(() => parseGtfsTime('invalid')).toThrow();
  });

  it('converts GTFS time to seconds', () => {
    expect(gtfsTimeToSeconds('00:00:00')).toBe(0);
    expect(gtfsTimeToSeconds('01:00:00')).toBe(3600);
    expect(gtfsTimeToSeconds('25:30:00')).toBe(91800);
  });

  it('converts seconds to GTFS time', () => {
    expect(secondsToGtfsTime(0)).toBe('00:00:00');
    expect(secondsToGtfsTime(3600)).toBe('01:00:00');
    expect(secondsToGtfsTime(91800)).toBe('25:30:00');
    expect(() => secondsToGtfsTime(-1)).toThrow();
    expect(() => secondsToGtfsTime(1.5)).toThrow();
  });

  it('round-trips seconds <-> GTFS time', () => {
    const times = ['00:00:00', '08:30:45', '25:01:00'];
    for (const t of times) {
      expect(secondsToGtfsTime(gtfsTimeToSeconds(t))).toBe(t);
    }
  });
});

describe('GtfsDate utilities', () => {
  it('validates GTFS date strings', () => {
    expect(isValidGtfsDate('20250401')).toBe(true);
    expect(isValidGtfsDate('2025-04-01')).toBe(false);
    expect(isValidGtfsDate('202504')).toBe(false);
    expect(isValidGtfsDate('')).toBe(false);
  });

  it('parses GTFS date strings', () => {
    const d = parseGtfsDate('20250401');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(3); // April (0-indexed)
    expect(d.getDate()).toBe(1);
    expect(() => parseGtfsDate('invalid')).toThrow();
  });

  it('converts Date to GTFS date string', () => {
    expect(toGtfsDate(new Date(2025, 3, 1))).toBe('20250401');
    expect(toGtfsDate(new Date(2025, 11, 31))).toBe('20251231');
  });

  it('formats GTFS date as ISO string', () => {
    expect(gtfsDateToIsoString('20250401')).toBe('2025-04-01');
    expect(gtfsDateToIsoString('20251231')).toBe('2025-12-31');
    expect(() => gtfsDateToIsoString('invalid')).toThrow();
  });

  it('round-trips Date <-> GTFS date', () => {
    const dates = [new Date(2025, 0, 1), new Date(2025, 11, 31)];
    for (const d of dates) {
      expect(parseGtfsDate(toGtfsDate(d))).toEqual(d);
    }
  });
});
