import {
  defineGtfsSchema,
  derivedTable,
  type DerivedTableRow,
  type SourceReadRow,
} from '@gtfs-jp/loader';
import type { KyselyDatabaseFromLoader } from '@gtfs-jp/loader/kysely';

type SampleRuntime = {
  timezone: string;
};

const universalCalendarColumns = {
  service_id: {
    kind: 'string',
    nullable: false,
  },
  date: {
    kind: 'number',
    nullable: false,
  },
} as const;

type UniversalCalendarRow = DerivedTableRow<typeof universalCalendarColumns>;
type CalendarRow = SourceReadRow<
  'calendar',
  [
    'service_id',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'start_date',
    'end_date',
  ]
>;
type CalendarDateRow = SourceReadRow<'calendar_dates', ['service_id', 'date', 'exception_type']>;

const universalCalendar = derivedTable<
  'universal_calendar',
  typeof universalCalendarColumns,
  SampleRuntime
>({
  name: 'universal_calendar',
  dependsOn: ['feed_info', 'calendar', 'calendar_dates'],
  columns: universalCalendarColumns,
  primaryKey: ['service_id', 'date'],
  indexes: [
    {
      columns: ['date'],
    },
  ],
  build: {
    kind: 'js',
    batchSize: 1000,
    run: async function* (context): AsyncIterable<UniversalCalendarRow> {
      if (typeof context.runtime.timezone !== 'string' || context.runtime.timezone.length === 0) {
        throw new Error('runtime.timezone is required');
      }

      const feedInfoRows = await context.readSource('feed_info', {
        limit: 1,
        columns: ['feed_start_date', 'feed_end_date'],
      });
      const feedInfo = feedInfoRows[0];

      if (!feedInfo?.feed_start_date || !feedInfo.feed_end_date) {
        throw new Error('feed_info must contain feed_start_date and feed_end_date');
      }

      const calendar = await context.readSource('calendar', {
        columns: [
          'service_id',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
          'start_date',
          'end_date',
        ],
      });

      const calendarDates = await context.readOptionalSource('calendar_dates', {
        columns: ['service_id', 'date', 'exception_type'],
      });

      const calendarMap = createCalendarMap(calendar);
      const calendarDatesMap = createCalendarDatesMap(calendarDates);
      const startCode = parseDateCode(feedInfo.feed_start_date);
      const endCode = parseDateCode(feedInfo.feed_end_date);

      for (const dateCode of enumerateDateCodes(startCode, endCode)) {
        const serviceIds = getTodayServices(dateCode, calendarMap, calendarDatesMap);
        for (const serviceId of serviceIds) {
          yield {
            service_id: serviceId,
            date: dateCode,
          };
        }
      }
    },
  },
});

type ServiceCalendarMap = Map<number, CalendarRow[]>;
type CalendarDatesMap = Map<number, { added: string[]; removed: string[] }>;

const parseDateCode = (value: string): number => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized)) {
    throw new Error(`Invalid GTFS date: ${value}`);
  }
  return normalized;
};

const parseDateParts = (dateCode: number): { year: number; month: number; day: number } => {
  const year = Math.floor(dateCode / 10000);
  const month = Math.floor((dateCode % 10000) / 100);
  const day = dateCode % 100;
  return { year, month, day };
};

const toDateCode = (date: Date): number => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return Number(`${year}${month}${day}`);
};

const addDays = (dateCode: number, days: number): number => {
  const { year, month, day } = parseDateParts(dateCode);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return toDateCode(next);
};

const enumerateDateCodes = function* (startDate: number, endDate: number): Iterable<number> {
  for (let current = startDate; current <= endDate; current = addDays(current, 1)) {
    yield current;
  }
};

const dayOfWeek = (dateCode: number): number => {
  const { year, month, day } = parseDateParts(dateCode);
  const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dayIndex === 0 ? 7 : dayIndex;
};

const isEnabled = (value: number | null): boolean => value === 1;

const createCalendarMap = (calendar: readonly CalendarRow[]): ServiceCalendarMap => {
  const calendarMap = new Map<number, CalendarRow[]>();

  for (const row of calendar) {
    const availableDays: number[] = [];
    if (isEnabled(row.monday)) availableDays.push(1);
    if (isEnabled(row.tuesday)) availableDays.push(2);
    if (isEnabled(row.wednesday)) availableDays.push(3);
    if (isEnabled(row.thursday)) availableDays.push(4);
    if (isEnabled(row.friday)) availableDays.push(5);
    if (isEnabled(row.saturday)) availableDays.push(6);
    if (isEnabled(row.sunday)) availableDays.push(7);

    for (const availableDay of availableDays) {
      const rows = calendarMap.get(availableDay) ?? [];
      rows.push(row);
      calendarMap.set(availableDay, rows);
    }
  }

  return calendarMap;
};

const createCalendarDatesMap = (calendarDates: readonly CalendarDateRow[]): CalendarDatesMap => {
  const calendarDatesMap: CalendarDatesMap = new Map();

  for (const row of calendarDates) {
    if (!row.date || !row.service_id) {
      continue;
    }

    const dateCode = parseDateCode(row.date);
    const entry = calendarDatesMap.get(dateCode) ?? { added: [], removed: [] };

    if (row.exception_type === 1) {
      entry.added.push(row.service_id);
    } else if (row.exception_type === 2) {
      entry.removed.push(row.service_id);
    }

    calendarDatesMap.set(dateCode, entry);
  }

  return calendarDatesMap;
};

const getTodayServices = (
  dateCode: number,
  calendarMap: ServiceCalendarMap,
  calendarDatesMap: CalendarDatesMap,
): string[] => {
  const services = new Set<string>();
  const regularCalendar = calendarMap.get(dayOfWeek(dateCode)) ?? [];

  for (const row of regularCalendar) {
    if (!row.service_id || !row.start_date || !row.end_date) {
      continue;
    }

    const startDate = parseDateCode(row.start_date);
    const endDate = parseDateCode(row.end_date);
    if (startDate <= dateCode && dateCode <= endDate) {
      services.add(row.service_id);
    }
  }

  const exceptions = calendarDatesMap.get(dateCode);
  if (exceptions) {
    for (const serviceId of exceptions.added) {
      services.add(serviceId);
    }
    for (const serviceId of exceptions.removed) {
      services.delete(serviceId);
    }
  }

  return [...services].sort();
};

export type SampleDatabase = KyselyDatabaseFromLoader<typeof schemaWithDerivedTables>;

export const createSampleSchema = (includeDerivedTables: boolean) =>
  includeDerivedTables ? schemaWithDerivedTables : schemaWithoutDerivedTables;

export const schemaWithDerivedTables = defineGtfsSchema<
  SampleRuntime,
  readonly [typeof universalCalendar]
>({
  derivedTables: [universalCalendar],
});

const schemaWithoutDerivedTables = defineGtfsSchema<SampleRuntime>({
  derivedTables: [],
});

export const sampleRuntime: SampleRuntime = {
  timezone: 'Asia/Tokyo',
};
