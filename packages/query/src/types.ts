import type { GtfsDatabase, Kysely } from '@gtfs-jp/loader/kysely';

export type GtfsQuerySource<TDB extends GtfsDatabase = GtfsDatabase> = {
  db: Kysely<TDB>;
  hasTable: (tableName: string) => Promise<boolean>;
};

export type GetActiveServiceIdsResult = {
  serviceIds: Set<string>;
  warnings: string[];
};

export type StopInfo = {
  stopId: string;
  stopCode: string | null;
  stopName: string;
  stopDesc: string | null;
  stopLat: number | null;
  stopLon: number | null;
  stopUrl: string | null;
  locationType: number | null;
  parentStation: string | null;
  stopTimezone: string | null;
  wheelchairBoarding: number | null;
  platformCode: string | null;
};

export type StopTimetableRow = {
  arrivalTime: string | null;
  departureTime: string | null;
  routeId: string;
  routeLabel: string;
  tripId: string;
  tripHeadsign: string | null;
  directionId: number | null;
  stopSequence: number;
  stopId: string;
  stopName: string;
  platformCode: string | null;
};

export type StopTimetableGroup = {
  stop: StopInfo;
  rows: StopTimetableRow[];
};

export type StopTimetableDetail = {
  selectedStop: StopInfo;
  childStops: StopInfo[];
  timetableGroups: StopTimetableGroup[];
  warnings: string[];
};

export type LoadStopTimetableOptions = {
  stopId: string;
  routeId?: string;
  serviceDate: string;
};
