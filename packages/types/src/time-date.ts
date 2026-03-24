import type { GtfsDate, GtfsTime } from './types.js';

// ---------------------------------------------------------------------------
// GtfsTime  (HH:MM:SS, hours may exceed 23 for post-midnight trips)
// ---------------------------------------------------------------------------

export type ParsedGtfsTime = {
  hours: number;
  minutes: number;
  seconds: number;
};

const GTFS_TIME_RE = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/;

export const isValidGtfsTime = (value: string): value is GtfsTime => GTFS_TIME_RE.test(value);

/**
 * Parses a GTFS time string (e.g. "25:30:00") into its components.
 * Hours can exceed 23 for trips that run past midnight.
 */
export const parseGtfsTime = (time: GtfsTime): ParsedGtfsTime => {
  const match = GTFS_TIME_RE.exec(time);
  if (!match) {
    throw new Error(`Invalid GTFS time: ${time}`);
  }
  return {
    hours: parseInt(match[1], 10),
    minutes: parseInt(match[2], 10),
    seconds: parseInt(match[3], 10),
  };
};

/**
 * Converts a GTFS time string to total seconds since midnight.
 * Values above 86400 represent post-midnight times.
 */
export const gtfsTimeToSeconds = (time: GtfsTime): number => {
  const { hours, minutes, seconds } = parseGtfsTime(time);
  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * Converts total seconds since midnight to a GTFS time string.
 * Accepts values above 86400 for post-midnight representation.
 */
export const secondsToGtfsTime = (totalSeconds: number): GtfsTime => {
  if (!Number.isInteger(totalSeconds) || totalSeconds < 0) {
    throw new Error(`Invalid seconds value: ${totalSeconds}`);
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` as GtfsTime;
};

// ---------------------------------------------------------------------------
// GtfsDate  (YYYYMMDD)
// ---------------------------------------------------------------------------

const GTFS_DATE_RE = /^(\d{4})(\d{2})(\d{2})$/;

export const isValidGtfsDate = (value: string): value is GtfsDate => GTFS_DATE_RE.test(value);

/**
 * Parses a GTFS date string (YYYYMMDD) into a local-time Date object.
 */
export const parseGtfsDate = (date: GtfsDate): Date => {
  const match = GTFS_DATE_RE.exec(date);
  if (!match) {
    throw new Error(`Invalid GTFS date: ${date}`);
  }
  return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
};

/**
 * Converts a Date to a GTFS date string (YYYYMMDD) using local time.
 */
export const toGtfsDate = (date: Date): GtfsDate => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}` as GtfsDate;
};

/**
 * Formats a GTFS date string as an ISO date string (YYYY-MM-DD).
 */
export const gtfsDateToIsoString = (date: GtfsDate): string => {
  const match = GTFS_DATE_RE.exec(date);
  if (!match) {
    throw new Error(`Invalid GTFS date: ${date}`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
};
