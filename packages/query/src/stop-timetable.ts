import type { SourceReadRow } from '@gtfs-jp/loader';
import type { GtfsDatabase, Kysely } from '@gtfs-jp/loader/kysely';

import { getActiveServiceIds } from './service-date.js';
import type {
  GtfsQuerySource,
  LoadStopTimetableOptions,
  StopInfo,
  StopTimetableDetail,
  StopTimetableGroup,
  StopTimetableRow,
} from './types.js';

type RouteLabelRow = SourceReadRow<'routes', ['route_id', 'route_short_name', 'route_long_name']>;

type StopRow = SourceReadRow<
  'stops',
  [
    'stop_id',
    'stop_code',
    'stop_name',
    'stop_desc',
    'stop_lat',
    'stop_lon',
    'stop_url',
    'location_type',
    'parent_station',
    'stop_timezone',
    'wheelchair_boarding',
    'platform_code',
  ]
>;

type TimetableSqlRow = SourceReadRow<
  'stop_times',
  ['arrival_time', 'departure_time', 'stop_sequence']
> &
  SourceReadRow<'routes', ['route_id', 'route_short_name', 'route_long_name']> &
  SourceReadRow<'trips', ['trip_id', 'trip_headsign', 'direction_id']> &
  SourceReadRow<'stops', ['stop_id', 'stop_name', 'platform_code']>;

type CompleteTimetableSqlRow = TimetableSqlRow & {
  route_id: string;
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
};

type UntypedGtfsDatabase = Record<string, Record<string, unknown>>;

const requiredTablesExist = async <TDB extends GtfsDatabase>(
  source: GtfsQuerySource<TDB>,
  tableNames: string[],
): Promise<string[]> => {
  const missing: string[] = [];
  for (const tableName of tableNames) {
    if (!(await source.hasTable(tableName))) {
      missing.push(tableName);
    }
  }
  return missing;
};

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const routeLabel = (row: RouteLabelRow): string => {
  const shortName = row.route_short_name?.trim();
  const longName = row.route_long_name?.trim();
  if (shortName && longName && shortName !== longName) {
    return `${shortName} ${longName}`;
  }
  return shortName || longName || row.route_id || '(unknown route)';
};

const toStopInfo = (row: StopRow): StopInfo | null => {
  if (!isNonEmptyString(row.stop_id)) return null;
  return {
    stopId: row.stop_id,
    stopCode: row.stop_code,
    stopName: row.stop_name ?? row.stop_id,
    stopDesc: row.stop_desc,
    stopLat: row.stop_lat,
    stopLon: row.stop_lon,
    stopUrl: row.stop_url,
    locationType: row.location_type,
    parentStation: row.parent_station,
    stopTimezone: row.stop_timezone,
    wheelchairBoarding: row.wheelchair_boarding,
    platformCode: row.platform_code,
  };
};

const loadStopsByIds = async <TDB extends GtfsDatabase>(
  source: GtfsQuerySource<TDB>,
  stopIds: string[],
): Promise<StopInfo[]> => {
  if (stopIds.length === 0) return [];
  const db = source.db as unknown as Kysely<UntypedGtfsDatabase>;

  const rows = (await db
    .selectFrom('stops')
    .select([
      'stop_id',
      'stop_code',
      'stop_name',
      'stop_desc',
      'stop_lat',
      'stop_lon',
      'stop_url',
      'location_type',
      'parent_station',
      'stop_timezone',
      'wheelchair_boarding',
      'platform_code',
    ])
    .where('stop_id', 'in', stopIds)
    .orderBy('stop_id')
    .execute()) as StopRow[];

  return rows.map(toStopInfo).filter((stop): stop is StopInfo => stop != null);
};

const loadStop = async <TDB extends GtfsDatabase>(
  source: GtfsQuerySource<TDB>,
  stopId: string,
): Promise<StopInfo | null> => {
  const rows = await loadStopsByIds(source, [stopId]);
  return rows[0] ?? null;
};

const loadChildStops = async <TDB extends GtfsDatabase>(
  source: GtfsQuerySource<TDB>,
  stopId: string,
): Promise<StopInfo[]> => {
  const db = source.db as unknown as Kysely<UntypedGtfsDatabase>;

  const rows = (await db
    .selectFrom('stops')
    .select([
      'stop_id',
      'stop_code',
      'stop_name',
      'stop_desc',
      'stop_lat',
      'stop_lon',
      'stop_url',
      'location_type',
      'parent_station',
      'stop_timezone',
      'wheelchair_boarding',
      'platform_code',
    ])
    .where('parent_station', '=', stopId)
    .orderBy('platform_code')
    .orderBy('stop_name')
    .orderBy('stop_id')
    .execute()) as StopRow[];

  return rows
    .map(toStopInfo)
    .filter((stop): stop is StopInfo => stop != null)
    .filter((stop) => stop.locationType === 0 || stop.locationType == null);
};

const normalizeTime = (value: string | null): number => {
  if (!value) return Number.POSITIVE_INFINITY;
  const match = /^(\d+):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
};

const isCompleteTimetableRow = (row: TimetableSqlRow): row is CompleteTimetableSqlRow =>
  isNonEmptyString(row.route_id) &&
  isNonEmptyString(row.trip_id) &&
  isNonEmptyString(row.stop_id) &&
  typeof row.stop_sequence === 'number' &&
  Number.isFinite(row.stop_sequence);

const loadTimetableRows = async <TDB extends GtfsDatabase>(
  source: GtfsQuerySource<TDB>,
  stopIds: string[],
  routeId: string | undefined,
  serviceIds: Set<string>,
): Promise<StopTimetableRow[]> => {
  if (stopIds.length === 0 || serviceIds.size === 0) return [];
  const db = source.db as unknown as Kysely<UntypedGtfsDatabase>;
  const serviceIdList = [...serviceIds];

  let query = db
    .selectFrom('stop_times as st')
    .innerJoin('trips as t', 't.trip_id', 'st.trip_id')
    .innerJoin('routes as r', 'r.route_id', 't.route_id')
    .innerJoin('stops as s', 's.stop_id', 'st.stop_id')
    .where('st.stop_id', 'in', stopIds)
    .where('t.service_id', 'in', serviceIdList);

  if (routeId) {
    query = query.where('r.route_id', '=', routeId);
  }

  const rows = (await query
    .select([
      'st.arrival_time as arrival_time',
      'st.departure_time as departure_time',
      'r.route_id as route_id',
      'r.route_short_name as route_short_name',
      'r.route_long_name as route_long_name',
      't.trip_id as trip_id',
      't.trip_headsign as trip_headsign',
      't.direction_id as direction_id',
      'st.stop_sequence as stop_sequence',
      's.stop_id as stop_id',
      's.stop_name as stop_name',
      's.platform_code as platform_code',
    ])
    .execute()) as TimetableSqlRow[];

  return rows
    .filter(isCompleteTimetableRow)
    .map<StopTimetableRow>((row) => ({
      arrivalTime: row.arrival_time,
      departureTime: row.departure_time,
      routeId: row.route_id,
      routeLabel: routeLabel(row),
      tripId: row.trip_id,
      tripHeadsign: row.trip_headsign,
      directionId: row.direction_id,
      stopSequence: row.stop_sequence,
      stopId: row.stop_id,
      stopName: row.stop_name ?? row.stop_id,
      platformCode: row.platform_code,
    }))
    .sort((a, b) => {
      const timeDiff =
        normalizeTime(a.departureTime ?? a.arrivalTime) -
        normalizeTime(b.departureTime ?? b.arrivalTime);
      if (timeDiff !== 0) return timeDiff;
      const routeDiff = a.routeLabel.localeCompare(b.routeLabel, 'ja');
      if (routeDiff !== 0) return routeDiff;
      return a.tripId.localeCompare(b.tripId, 'ja');
    });
};

export const getStopTimetableDetail = async <TDB extends GtfsDatabase>(
  source: GtfsQuerySource<TDB>,
  options: LoadStopTimetableOptions,
): Promise<StopTimetableDetail> => {
  const warnings: string[] = [];
  const missing = await requiredTablesExist(source, ['routes', 'trips', 'stop_times', 'stops']);
  if (missing.length > 0) {
    throw new Error(`${missing.join(', ')} table がありません。`);
  }

  const selectedStop = await loadStop(source, options.stopId);
  if (!selectedStop) {
    throw new Error(`stop_id ${options.stopId} が見つかりません。`);
  }

  const childStops =
    selectedStop.locationType === 1 ? await loadChildStops(source, options.stopId) : [];
  const timetableStops = childStops.length > 0 ? childStops : [selectedStop];
  const activeService = await getActiveServiceIds(source, options.serviceDate);
  warnings.push(...activeService.warnings);

  const timetableRows = await loadTimetableRows(
    source,
    timetableStops.map((stop) => stop.stopId),
    options.routeId,
    activeService.serviceIds,
  );

  const rowsByStopId = new Map<string, StopTimetableRow[]>();
  for (const row of timetableRows) {
    const rows = rowsByStopId.get(row.stopId) ?? [];
    rows.push(row);
    rowsByStopId.set(row.stopId, rows);
  }

  const timetableGroups: StopTimetableGroup[] = timetableStops.map((stop) => ({
    stop,
    rows: rowsByStopId.get(stop.stopId) ?? [],
  }));

  return {
    selectedStop,
    childStops,
    timetableGroups,
    warnings,
  };
};
