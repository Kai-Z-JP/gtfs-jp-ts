import type {
  LoadStopTimetableOptions,
  StopInfo,
  StopTimetableDetail,
  StopTimetableGroup,
  StopTimetableRow,
} from '@gtfs-jp/query';

export type GeoJsonPosition = [number, number];

export type GeoJsonLineString = {
  type: 'LineString';
  coordinates: GeoJsonPosition[];
};

export type GeoJsonPoint = {
  type: 'Point';
  coordinates: GeoJsonPosition;
};

export type GeoJsonFeature<TGeometry, TProperties extends Record<string, unknown>> = {
  type: 'Feature';
  geometry: TGeometry;
  properties: TProperties;
};

export type GeoJsonFeatureCollection<TGeometry, TProperties extends Record<string, unknown>> = {
  type: 'FeatureCollection';
  features: Array<GeoJsonFeature<TGeometry, TProperties>>;
};

export type RouteMapBounds = [GeoJsonPosition, GeoJsonPosition];

export type RouteMapRouteOption = {
  routeId: string;
  label: string;
  color: string;
  routeType: number | null;
};

export type RouteMapOptions = {
  routes: RouteMapRouteOption[];
  feedStartDate: string;
  feedEndDate: string;
  defaultServiceDate: string;
  warnings: string[];
};

export type RouteMapLineProperties = {
  routeId: string;
  routeLabel: string;
  color: string;
  fallback: boolean;
};

export type RouteMapStopKind = 'parent_stop' | 'pole';

export type RouteMapStopProperties = {
  stopId: string;
  stopName: string;
  stopCode: string | null;
  parentStation: string | null;
  platformCode: string | null;
  locationType: number | null;
  kind: RouteMapStopKind;
};

export type RouteMapData = {
  routeLines: GeoJsonFeatureCollection<GeoJsonLineString, RouteMapLineProperties>;
  parentStops: GeoJsonFeatureCollection<GeoJsonPoint, RouteMapStopProperties>;
  poles: GeoJsonFeatureCollection<GeoJsonPoint, RouteMapStopProperties>;
  bounds: RouteMapBounds | null;
  stats: {
    routeLineCount: number;
    parentStopCount: number;
    poleCount: number;
  };
  warnings: string[];
};

export type RouteMapStopInfo = StopInfo;

export type RouteMapTimetableRow = StopTimetableRow;

export type RouteMapTimetableGroup = StopTimetableGroup;

export type RouteMapStopDetail = StopTimetableDetail;

export type LoadRouteMapDataOptions = {
  routeId?: string;
  serviceDate: string;
};

export type LoadStopDetailOptions = LoadStopTimetableOptions;
