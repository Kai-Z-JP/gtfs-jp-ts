import type { Kysely } from 'kysely';
import type { SourceReadRow } from '@gtfs-jp/loader';
import {
  getActiveServiceIds as getActiveServiceIdsFromQuery,
  getStopTimetableDetail,
  type GtfsQuerySource,
} from '@gtfs-jp/query';

import type {
  GeoJsonFeature,
  GeoJsonLineString,
  GeoJsonPoint,
  GeoJsonPosition,
  LoadRouteMapDataOptions,
  LoadStopDetailOptions,
  RouteMapBounds,
  RouteMapData,
  RouteMapLineProperties,
  RouteMapOptions,
  RouteMapRouteOption,
  RouteMapStopDetail,
  RouteMapStopInfo,
  RouteMapStopProperties,
} from '../../domain/gtfsWorkbench';
import type { SampleDatabase } from '../../infrastructure/gtfsLoader/schema';

type RouteMapDataSource = GtfsQuerySource<SampleDatabase>;

type RouteRow = SourceReadRow<
  'routes',
  ['route_id', 'route_short_name', 'route_long_name', 'route_color', 'route_type']
>;

type RouteLabelRow = SourceReadRow<'routes', ['route_id', 'route_short_name', 'route_long_name']>;

type FeedInfoRow = SourceReadRow<'feed_info', ['feed_start_date', 'feed_end_date']>;

type ShapeLineRow = RouteRow &
  SourceReadRow<'trips', ['shape_id', 'jp_pattern_id']> &
  SourceReadRow<'shapes', ['shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence']>;

type FallbackLineRow = RouteRow &
  SourceReadRow<'trips', ['trip_id', 'jp_pattern_id']> &
  SourceReadRow<'stop_times', ['stop_id', 'stop_sequence']> &
  SourceReadRow<'stops', ['stop_lat', 'stop_lon']>;

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

type RoutePatternTarget = {
  routeId: string;
  patternId: string | null;
};

const emptyLineCollection = {
  type: 'FeatureCollection',
  features: [],
} satisfies RouteMapData['routeLines'];

const emptyPointCollection = {
  type: 'FeatureCollection',
  features: [],
} satisfies RouteMapData['parentStops'];

const fallbackColors = [
  '#e11d48',
  '#2563eb',
  '#16a34a',
  '#ca8a04',
  '#0891b2',
  '#7c3aed',
  '#db2777',
  '#475569',
] as const;

const emptyMapData = (warnings: string[] = []): RouteMapData => ({
  routeLines: emptyLineCollection,
  parentStops: emptyPointCollection,
  poles: emptyPointCollection,
  bounds: null,
  stats: {
    routeLineCount: 0,
    parentStopCount: 0,
    poleCount: 0,
  },
  warnings,
});

const tableExists = async (source: RouteMapDataSource, tableName: string): Promise<boolean> =>
  await source.hasTable(tableName);

const requiredTablesExist = async (
  source: RouteMapDataSource,
  tableNames: string[],
): Promise<string[]> => {
  const missing: string[] = [];
  for (const tableName of tableNames) {
    if (!(await tableExists(source, tableName))) {
      missing.push(tableName);
    }
  }
  return missing;
};

const toInputDate = (value: string | number | null | undefined): string => {
  const raw = value == null ? '' : String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (!/^\d{8}$/.test(raw)) return '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
};

const todayInputDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const clampDefaultServiceDate = (start: string, end: string): string => {
  const today = todayInputDate();
  if (start && end && start <= today && today <= end) {
    return today;
  }
  return start || today;
};

const routeLabel = (row: RouteLabelRow): string => {
  const shortName = row.route_short_name?.trim();
  const longName = row.route_long_name?.trim();
  if (shortName && longName && shortName !== longName) {
    return `${shortName} ${longName}`;
  }
  return shortName || longName || row.route_id || '(unknown route)';
};

const stableFallbackColor = (routeId: string): string => {
  let hash = 0;
  for (const char of routeId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return fallbackColors[hash % fallbackColors.length];
};

const normalizeColor = (routeId: string, value: string | null): string => {
  const trimmed = value?.trim().replace(/^#/, '') ?? '';
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed}`;
  }
  return stableFallbackColor(routeId);
};

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const normalizePatternId = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const routePatternKey = (routeId: string, patternId: string | null | undefined): string => {
  const normalizedPatternId = normalizePatternId(patternId);
  return normalizedPatternId ? `${routeId}\u0000${normalizedPatternId}` : routeId;
};

const toPosition = (lat: number | null, lon: number | null): GeoJsonPosition | null => {
  const valid =
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    typeof lon === 'number' &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180;

  return valid ? [lon, lat] : null;
};

const expandBounds = (
  bounds: RouteMapBounds | null,
  [lon, lat]: GeoJsonPosition,
): RouteMapBounds => {
  if (!bounds) {
    return [
      [lon, lat],
      [lon, lat],
    ];
  }

  return [
    [Math.min(bounds[0][0], lon), Math.min(bounds[0][1], lat)],
    [Math.max(bounds[1][0], lon), Math.max(bounds[1][1], lat)],
  ];
};

const loadRoutes = async (db: Kysely<SampleDatabase>): Promise<RouteRow[]> =>
  (await db
    .selectFrom('routes')
    .select(['route_id', 'route_short_name', 'route_long_name', 'route_color', 'route_type'])
    .orderBy('route_sort_order')
    .orderBy('route_id')
    .execute()) as RouteRow[];

export const loadRouteMapOptions = async (source: RouteMapDataSource): Promise<RouteMapOptions> => {
  const db = source.db;
  const warnings: string[] = [];
  const missing = await requiredTablesExist(source, ['routes']);
  if (missing.length > 0) {
    return {
      routes: [],
      feedStartDate: '',
      feedEndDate: '',
      defaultServiceDate: todayInputDate(),
      warnings: [`${missing.join(', ')} table がありません。`],
    };
  }

  const routes = await loadRoutes(db);
  let feedStartDate = '';
  let feedEndDate = '';

  if (await tableExists(source, 'feed_info')) {
    const feedInfoRows = (await db
      .selectFrom('feed_info')
      .select(['feed_start_date', 'feed_end_date'])
      .limit(1)
      .execute()) as FeedInfoRow[];
    feedStartDate = toInputDate(feedInfoRows[0]?.feed_start_date);
    feedEndDate = toInputDate(feedInfoRows[0]?.feed_end_date);
  } else {
    warnings.push('feed_info table がないため、日付範囲を初期設定できません。');
  }

  return {
    routes: routes
      .filter((row): row is RouteRow & { route_id: string } => isNonEmptyString(row.route_id))
      .map<RouteMapRouteOption>((row) => ({
        routeId: row.route_id,
        label: routeLabel(row),
        color: normalizeColor(row.route_id, row.route_color),
        routeType: row.route_type,
      })),
    feedStartDate,
    feedEndDate,
    defaultServiceDate: clampDefaultServiceDate(feedStartDate, feedEndDate),
    warnings,
  };
};

const loadCandidateRoutePatterns = async (
  db: Kysely<SampleDatabase>,
  routeId: string | undefined,
  serviceIds: Set<string>,
): Promise<RoutePatternTarget[]> => {
  const serviceIdList = [...serviceIds];
  if (serviceIdList.length === 0) return [];

  let query = db
    .selectFrom('routes as r')
    .innerJoin('trips as t', 't.route_id', 'r.route_id')
    .where('r.route_id', 'is not', null)
    .where('t.service_id', 'in', serviceIdList);

  if (routeId) {
    query = query.where('r.route_id', '=', routeId);
  }

  const rows = (await query
    .distinct()
    .select(['r.route_id as route_id', 't.jp_pattern_id as jp_pattern_id'])
    .orderBy('r.route_id')
    .orderBy('t.jp_pattern_id')
    .execute()) as Array<{ route_id: string | null; jp_pattern_id: string | null }>;

  const targets: RoutePatternTarget[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isNonEmptyString(row.route_id)) continue;
    const patternId = normalizePatternId(row.jp_pattern_id);
    const key = routePatternKey(row.route_id, patternId);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({
      routeId: row.route_id,
      patternId,
    });
  }

  return targets;
};

const loadShapeLineRows = async (
  db: Kysely<SampleDatabase>,
  routeId: string | undefined,
  serviceIds: Set<string>,
): Promise<ShapeLineRow[]> => {
  const serviceIdList = [...serviceIds];
  if (serviceIdList.length === 0) return [];

  let query = db
    .selectFrom('routes as r')
    .innerJoin('trips as t', 't.route_id', 'r.route_id')
    .innerJoin('shapes as s', 's.shape_id', 't.shape_id')
    .where('t.shape_id', 'is not', null)
    .where('t.service_id', 'in', serviceIdList);

  if (routeId) {
    query = query.where('r.route_id', '=', routeId);
  }

  return (await query
    .distinct()
    .select([
      'r.route_id as route_id',
      'r.route_short_name as route_short_name',
      'r.route_long_name as route_long_name',
      'r.route_color as route_color',
      'r.route_type as route_type',
      't.shape_id as shape_id',
      't.jp_pattern_id as jp_pattern_id',
      's.shape_pt_lat as shape_pt_lat',
      's.shape_pt_lon as shape_pt_lon',
      's.shape_pt_sequence as shape_pt_sequence',
    ])
    .orderBy('r.route_id')
    .orderBy('t.shape_id')
    .orderBy('s.shape_pt_sequence')
    .execute()) as ShapeLineRow[];
};

const buildShapeFeatures = (
  rows: ShapeLineRow[],
  bounds: RouteMapBounds | null,
  warnings: string[],
): {
  features: Array<GeoJsonFeature<GeoJsonLineString, RouteMapLineProperties>>;
  bounds: RouteMapBounds | null;
  routePatternKeysWithLines: Set<string>;
} => {
  const grouped = new Map<string, ShapeLineRow[]>();
  let nextBounds = bounds;

  for (const row of rows) {
    if (!isNonEmptyString(row.route_id) || !isNonEmptyString(row.shape_id)) continue;
    const key = `${routePatternKey(row.route_id, row.jp_pattern_id)}\u0000${row.shape_id}`;
    const entries = grouped.get(key) ?? [];
    entries.push(row);
    grouped.set(key, entries);
  }

  const features: Array<GeoJsonFeature<GeoJsonLineString, RouteMapLineProperties>> = [];
  const routePatternKeysWithLines = new Set<string>();
  let skipped = 0;

  for (const entries of grouped.values()) {
    const first = entries[0];
    if (!first || !isNonEmptyString(first.route_id)) continue;

    const coordinates: GeoJsonPosition[] = [];
    for (const row of entries) {
      const position = toPosition(row.shape_pt_lat, row.shape_pt_lon);
      if (position) {
        coordinates.push(position);
        nextBounds = expandBounds(nextBounds, position);
      }
    }

    if (coordinates.length < 2) {
      skipped += 1;
      continue;
    }

    routePatternKeysWithLines.add(routePatternKey(first.route_id, first.jp_pattern_id));
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates,
      },
      properties: {
        routeId: first.route_id,
        routeLabel: routeLabel(first),
        color: normalizeColor(first.route_id, first.route_color),
        fallback: false,
      },
    });
  }

  if (skipped > 0) {
    warnings.push(`座標不足の shape を ${skipped} 件スキップしました。`);
  }

  return { features, bounds: nextBounds, routePatternKeysWithLines };
};

const loadFallbackTripIds = async (
  db: Kysely<SampleDatabase>,
  targets: RoutePatternTarget[],
  serviceIds: Set<string>,
): Promise<string[]> => {
  if (targets.length === 0) return [];
  const serviceIdList = [...serviceIds];
  if (serviceIdList.length === 0) return [];
  const routeIds = [...new Set(targets.map((target) => target.routeId))];
  const targetKeys = new Set(
    targets.map((target) => routePatternKey(target.routeId, target.patternId)),
  );

  const rows = (await db
    .selectFrom('trips')
    .select(['route_id', 'trip_id', 'jp_pattern_id'])
    .where('route_id', 'in', routeIds)
    .where('service_id', 'in', serviceIdList)
    .orderBy('route_id')
    .orderBy('jp_pattern_id')
    .orderBy('trip_id')
    .execute()) as Array<{
    route_id: string | null;
    trip_id: string | null;
    jp_pattern_id: string | null;
  }>;

  const tripIds: string[] = [];
  const seenKeys = new Set<string>();
  for (const row of rows) {
    if (!isNonEmptyString(row.route_id) || !isNonEmptyString(row.trip_id)) continue;
    const key = routePatternKey(row.route_id, row.jp_pattern_id);
    if (!targetKeys.has(key) || seenKeys.has(key)) continue;
    seenKeys.add(key);
    tripIds.push(row.trip_id);
  }
  return tripIds;
};

const loadFallbackLineRows = async (
  db: Kysely<SampleDatabase>,
  tripIds: string[],
): Promise<FallbackLineRow[]> => {
  if (tripIds.length === 0) return [];
  return (await db
    .selectFrom('stop_times as st')
    .innerJoin('trips as t', 't.trip_id', 'st.trip_id')
    .innerJoin('routes as r', 'r.route_id', 't.route_id')
    .innerJoin('stops as s', 's.stop_id', 'st.stop_id')
    .select([
      'r.route_id as route_id',
      'r.route_short_name as route_short_name',
      'r.route_long_name as route_long_name',
      'r.route_color as route_color',
      'r.route_type as route_type',
      't.trip_id as trip_id',
      't.jp_pattern_id as jp_pattern_id',
      'st.stop_id as stop_id',
      'st.stop_sequence as stop_sequence',
      's.stop_lat as stop_lat',
      's.stop_lon as stop_lon',
    ])
    .where('st.trip_id', 'in', tripIds)
    .orderBy('r.route_id')
    .orderBy('t.trip_id')
    .orderBy('st.stop_sequence')
    .execute()) as FallbackLineRow[];
};

const buildFallbackFeatures = (
  rows: FallbackLineRow[],
  bounds: RouteMapBounds | null,
  warnings: string[],
): {
  features: Array<GeoJsonFeature<GeoJsonLineString, RouteMapLineProperties>>;
  bounds: RouteMapBounds | null;
} => {
  const grouped = new Map<string, FallbackLineRow[]>();
  let nextBounds = bounds;

  for (const row of rows) {
    if (!isNonEmptyString(row.route_id) || !isNonEmptyString(row.trip_id)) continue;
    const key = `${row.route_id}\u0000${row.trip_id}`;
    const entries = grouped.get(key) ?? [];
    entries.push(row);
    grouped.set(key, entries);
  }

  const features: Array<GeoJsonFeature<GeoJsonLineString, RouteMapLineProperties>> = [];
  let skipped = 0;

  for (const entries of grouped.values()) {
    const first = entries[0];
    if (!first || !isNonEmptyString(first.route_id)) continue;
    const coordinates: GeoJsonPosition[] = [];

    for (const row of entries) {
      const position = toPosition(row.stop_lat, row.stop_lon);
      if (position) {
        coordinates.push(position);
        nextBounds = expandBounds(nextBounds, position);
      }
    }

    if (coordinates.length < 2) {
      skipped += 1;
      continue;
    }

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates,
      },
      properties: {
        routeId: first.route_id,
        routeLabel: routeLabel(first),
        color: normalizeColor(first.route_id, first.route_color),
        fallback: true,
      },
    });
  }

  if (skipped > 0) {
    warnings.push(`停留所列から路線を作れない trip を ${skipped} 件スキップしました。`);
  }

  return { features, bounds: nextBounds };
};

const toStopInfo = (row: StopRow): RouteMapStopInfo | null => {
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

const loadStopsByIds = async (
  db: Kysely<SampleDatabase>,
  stopIds: string[],
): Promise<RouteMapStopInfo[]> => {
  if (stopIds.length === 0) return [];
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
  return rows.map(toStopInfo).filter((stop): stop is RouteMapStopInfo => stop != null);
};

const loadUsedStops = async (
  db: Kysely<SampleDatabase>,
  routeId: string | undefined,
  serviceIds: Set<string>,
): Promise<RouteMapStopInfo[]> => {
  const serviceIdList = [...serviceIds];
  if (serviceIdList.length === 0) return [];

  let query = db
    .selectFrom('stops as s')
    .innerJoin('stop_times as st', 'st.stop_id', 's.stop_id')
    .innerJoin('trips as t', 't.trip_id', 'st.trip_id')
    .innerJoin('routes as r', 'r.route_id', 't.route_id')
    .where('t.service_id', 'in', serviceIdList);

  if (routeId) {
    query = query.where('r.route_id', '=', routeId);
  }

  const rows = (await query
    .distinct()
    .select([
      's.stop_id as stop_id',
      's.stop_code as stop_code',
      's.stop_name as stop_name',
      's.stop_desc as stop_desc',
      's.stop_lat as stop_lat',
      's.stop_lon as stop_lon',
      's.stop_url as stop_url',
      's.location_type as location_type',
      's.parent_station as parent_station',
      's.stop_timezone as stop_timezone',
      's.wheelchair_boarding as wheelchair_boarding',
      's.platform_code as platform_code',
    ])
    .orderBy('s.stop_id')
    .execute()) as StopRow[];

  const stops = rows.map(toStopInfo).filter((stop): stop is RouteMapStopInfo => stop != null);
  const seen = new Set(stops.map((stop) => stop.stopId));
  const parentIds = stops
    .map((stop) => stop.parentStation)
    .filter((id): id is string => isNonEmptyString(id) && !seen.has(id));
  const parentStops = await loadStopsByIds(db, [...new Set(parentIds)]);
  return [...stops, ...parentStops];
};

const buildStopFeatures = (
  stops: RouteMapStopInfo[],
  bounds: RouteMapBounds | null,
  warnings: string[],
): {
  parentFeatures: Array<GeoJsonFeature<GeoJsonPoint, RouteMapStopProperties>>;
  poleFeatures: Array<GeoJsonFeature<GeoJsonPoint, RouteMapStopProperties>>;
  bounds: RouteMapBounds | null;
} => {
  let nextBounds = bounds;
  const parentFeatures: Array<GeoJsonFeature<GeoJsonPoint, RouteMapStopProperties>> = [];
  const poleFeatures: Array<GeoJsonFeature<GeoJsonPoint, RouteMapStopProperties>> = [];
  let invalidCount = 0;

  for (const stop of stops) {
    const isParent = stop.locationType === 1;
    const isPole = stop.locationType === 0 || stop.locationType == null;
    if (!isParent && !isPole) continue;

    const position = toPosition(stop.stopLat, stop.stopLon);
    if (!position) {
      invalidCount += 1;
      continue;
    }

    const feature: GeoJsonFeature<GeoJsonPoint, RouteMapStopProperties> = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: position,
      },
      properties: {
        stopId: stop.stopId,
        stopName: stop.stopName,
        stopCode: stop.stopCode,
        parentStation: stop.parentStation,
        platformCode: stop.platformCode,
        locationType: stop.locationType,
        kind: isParent ? 'parent_stop' : 'pole',
      },
    };

    nextBounds = expandBounds(nextBounds, position);
    if (isParent) {
      parentFeatures.push(feature);
    } else {
      poleFeatures.push(feature);
    }
  }

  if (invalidCount > 0) {
    warnings.push(`座標が不正な停留所/標柱を ${invalidCount} 件スキップしました。`);
  }

  return { parentFeatures, poleFeatures, bounds: nextBounds };
};

export const loadRouteMapData = async (
  source: RouteMapDataSource,
  options: LoadRouteMapDataOptions,
): Promise<RouteMapData> => {
  const db = source.db;
  const warnings: string[] = [];
  const missing = await requiredTablesExist(source, ['routes', 'trips', 'stop_times', 'stops']);
  if (missing.length > 0) {
    return emptyMapData([`${missing.join(', ')} table がありません。`]);
  }

  const activeService = await getActiveServiceIdsFromQuery(source, options.serviceDate);
  warnings.push(...activeService.warnings);
  const serviceIds = activeService.serviceIds;
  const candidateRoutePatterns = await loadCandidateRoutePatterns(db, options.routeId, serviceIds);
  let bounds: RouteMapBounds | null = null;
  let routeLineFeatures: Array<GeoJsonFeature<GeoJsonLineString, RouteMapLineProperties>> = [];
  let routePatternKeysWithLines = new Set<string>();

  if (await tableExists(source, 'shapes')) {
    const shapeRows = await loadShapeLineRows(db, options.routeId, serviceIds);
    const shapeResult = buildShapeFeatures(shapeRows, bounds, warnings);
    routeLineFeatures = shapeResult.features;
    bounds = shapeResult.bounds;
    routePatternKeysWithLines = shapeResult.routePatternKeysWithLines;
  } else {
    warnings.push('shapes table がないため、停留所順の簡易線で表示します。');
  }

  const fallbackTargets = candidateRoutePatterns.filter(
    (target) => !routePatternKeysWithLines.has(routePatternKey(target.routeId, target.patternId)),
  );
  const fallbackTripIds = await loadFallbackTripIds(db, fallbackTargets, serviceIds);
  const fallbackRows = await loadFallbackLineRows(db, fallbackTripIds);
  const fallbackResult = buildFallbackFeatures(fallbackRows, bounds, warnings);
  routeLineFeatures = [...routeLineFeatures, ...fallbackResult.features];
  bounds = fallbackResult.bounds;

  const stops = await loadUsedStops(db, options.routeId, serviceIds);
  const stopResult = buildStopFeatures(stops, bounds, warnings);
  bounds = stopResult.bounds;

  return {
    routeLines: {
      type: 'FeatureCollection',
      features: routeLineFeatures,
    },
    parentStops: {
      type: 'FeatureCollection',
      features: stopResult.parentFeatures,
    },
    poles: {
      type: 'FeatureCollection',
      features: stopResult.poleFeatures,
    },
    bounds,
    stats: {
      routeLineCount: routeLineFeatures.length,
      parentStopCount: stopResult.parentFeatures.length,
      poleCount: stopResult.poleFeatures.length,
    },
    warnings,
  };
};

export const loadStopDetail = async (
  source: RouteMapDataSource,
  options: LoadStopDetailOptions,
): Promise<RouteMapStopDetail> => await getStopTimetableDetail(source, options);
