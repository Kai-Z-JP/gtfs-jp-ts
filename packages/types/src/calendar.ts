import type { GtfsDate, GtfsJpV4TableRow } from './types.js';
import { toGtfsDate } from './time-date.js';

// Day-of-week column names in GTFS calendar, indexed by Date#getDay() (0=Sun)
const DOW_COLUMNS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export interface ServiceCalendarIndex {
  /**
   * Returns true if the service is running on the given date.
   * Accepts a Date object or a GTFS date string (YYYYMMDD).
   */
  isActive(serviceId: string, date: Date | GtfsDate): boolean;

  /**
   * Returns all service IDs that are active on the given date.
   * Accepts a Date object or a GTFS date string (YYYYMMDD).
   */
  getActiveServiceIds(date: Date | GtfsDate): string[];
}

const toDateKey = (date: Date | GtfsDate): GtfsDate =>
  typeof date === 'string' ? date : toGtfsDate(date);

const toDate = (date: Date | GtfsDate): Date => {
  if (typeof date === 'string') {
    const y = parseInt(date.slice(0, 4), 10);
    const m = parseInt(date.slice(4, 6), 10) - 1;
    const d = parseInt(date.slice(6, 8), 10);
    return new Date(y, m, d);
  }
  return date;
};

/**
 * Builds a ServiceCalendarIndex from calendar and calendar_dates rows.
 * Supports GTFS calendar.txt (regular weekly schedules) and
 * calendar_dates.txt (exception overrides).
 *
 * Accepts GtfsJpV4TableRow<'calendar'> / GtfsJpV4TableRow<'calendar_dates'>
 * directly from loader.readTable() calls.
 */
export const buildServiceCalendarIndex = (
  calendar: readonly GtfsJpV4TableRow<'calendar'>[],
  calendarDates: readonly GtfsJpV4TableRow<'calendar_dates'>[],
): ServiceCalendarIndex => {
  type CalRow = GtfsJpV4TableRow<'calendar'>;

  // Map: serviceId -> CalendarRow
  const calendarMap = new Map<string, CalRow>();
  for (const row of calendar) {
    calendarMap.set(row.service_id, row);
  }

  // Map: serviceId -> Map<dateKey, exception_type>
  const exceptionsMap = new Map<string, Map<GtfsDate, 1 | 2>>();
  for (const row of calendarDates) {
    let byDate = exceptionsMap.get(row.service_id);
    if (!byDate) {
      byDate = new Map();
      exceptionsMap.set(row.service_id, byDate);
    }
    byDate.set(row.date, row.exception_type ?? 1);
  }

  const allServiceIds = new Set([...calendarMap.keys(), ...exceptionsMap.keys()]);

  const isActive = (serviceId: string, date: Date | GtfsDate): boolean => {
    const dateKey = toDateKey(date);

    // Check exception first
    const exception = exceptionsMap.get(serviceId)?.get(dateKey);
    if (exception === 1) return true;
    if (exception === 2) return false;

    // Fall back to regular calendar
    const row = calendarMap.get(serviceId);
    if (!row) return false;

    if (dateKey < row.start_date || dateKey > row.end_date) return false;

    const d = toDate(date);
    const dowCol = DOW_COLUMNS[d.getDay()];
    return row[dowCol] === 1;
  };

  const getActiveServiceIds = (date: Date | GtfsDate): string[] => {
    const result: string[] = [];
    for (const serviceId of allServiceIds) {
      if (isActive(serviceId, date)) result.push(serviceId);
    }
    return result;
  };

  return { isActive, getActiveServiceIds };
};
