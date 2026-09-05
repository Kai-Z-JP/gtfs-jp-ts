import type { SourceReadRow } from '@gtfs-jp/loader';
import type { GtfsDatabase, Kysely } from '@gtfs-jp/loader/kysely';

import type { GetActiveServiceIdsResult, GtfsQuerySource } from './types.js';

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

type ParsedServiceDate = {
  dateCode: number;
  dayIndex: number;
};

type UntypedGtfsDatabase = Record<string, Record<string, unknown>>;

const tableExists = async <TDB extends GtfsDatabase>(
  source: GtfsQuerySource<TDB>,
  tableName: string,
): Promise<boolean> => await source.hasTable(tableName);

const parseServiceDate = (value: string): ParsedServiceDate | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    dateCode: year * 10000 + month * 100 + day,
    dayIndex: date.getUTCDay(),
  };
};

const toGtfsDateCode = (value: string | number | null | undefined): number | null => {
  if (value == null) {
    return null;
  }

  const raw = String(value);
  if (!/^\d{8}$/.test(raw)) {
    return null;
  }

  const dateCode = Number(raw);
  return Number.isInteger(dateCode) ? dateCode : null;
};

const dayColumnForIndex = (dayIndex: number): keyof CalendarRow => {
  return (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const)[
    dayIndex
  ];
};

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

export const getActiveServiceIds = async <TDB extends GtfsDatabase>(
  source: GtfsQuerySource<TDB>,
  serviceDate: string,
): Promise<GetActiveServiceIdsResult> => {
  const db = source.db as unknown as Kysely<UntypedGtfsDatabase>;
  const warnings: string[] = [];

  if (!(await tableExists(source, 'calendar'))) {
    warnings.push('calendar table がないため、指定日の運行判定ができません。');
    return { serviceIds: new Set<string>(), warnings };
  }

  const parsedServiceDate = parseServiceDate(serviceDate);
  if (!parsedServiceDate) {
    warnings.push(`日付 ${serviceDate} を GTFS の service date として解釈できません。`);
    return { serviceIds: new Set<string>(), warnings };
  }

  const dateCode = parsedServiceDate.dateCode;
  const dayColumn = dayColumnForIndex(parsedServiceDate.dayIndex);
  const calendarRows = (await db
    .selectFrom('calendar')
    .select([
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
    ])
    .execute()) as CalendarRow[];
  const serviceIds = new Set<string>();

  for (const row of calendarRows) {
    const startDate = toGtfsDateCode(row.start_date);
    const endDate = toGtfsDateCode(row.end_date);
    if (
      isNonEmptyString(row.service_id) &&
      row[dayColumn] === 1 &&
      startDate != null &&
      endDate != null &&
      startDate <= dateCode &&
      dateCode <= endDate
    ) {
      serviceIds.add(row.service_id);
    }
  }

  if (await tableExists(source, 'calendar_dates')) {
    const exceptionRows = (await db
      .selectFrom('calendar_dates')
      .select(['service_id', 'date', 'exception_type'])
      .execute()) as CalendarDateRow[];

    for (const row of exceptionRows) {
      if (toGtfsDateCode(row.date) !== dateCode) continue;
      if (!isNonEmptyString(row.service_id)) continue;
      if (row.exception_type === 1) {
        serviceIds.add(row.service_id);
      } else if (row.exception_type === 2) {
        serviceIds.delete(row.service_id);
      }
    }
  }

  if (serviceIds.size === 0) {
    warnings.push(`${serviceDate} に運行する service_id が見つかりません。`);
  }

  return { serviceIds, warnings };
};
