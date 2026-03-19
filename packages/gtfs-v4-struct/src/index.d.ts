export type GtfsV4Requirement = "required" | "recommended" | "optional";
export interface GtfsV4TableSpec<Name extends string = string, FileName extends string = string> {
    fileName: FileName;
    tableName: Name;
    requirement: GtfsV4Requirement;
}
export declare const GTFS_V4_TABLE_SPECS: readonly [{
    readonly fileName: "agency.txt";
    readonly tableName: "agency";
    readonly requirement: "required";
}, {
    readonly fileName: "levels.txt";
    readonly tableName: "levels";
    readonly requirement: "required";
}, {
    readonly fileName: "stops.txt";
    readonly tableName: "stops";
    readonly requirement: "required";
}, {
    readonly fileName: "locations.geojson";
    readonly tableName: "locations_geojson";
    readonly requirement: "recommended";
}, {
    readonly fileName: "routes.txt";
    readonly tableName: "routes";
    readonly requirement: "recommended";
}, {
    readonly fileName: "route_patterns.txt";
    readonly tableName: "route_patterns";
    readonly requirement: "recommended";
}, {
    readonly fileName: "trips.txt";
    readonly tableName: "trips";
    readonly requirement: "optional";
}, {
    readonly fileName: "frequencies.txt";
    readonly tableName: "frequencies";
    readonly requirement: "optional";
}, {
    readonly fileName: "stop_times.txt";
    readonly tableName: "stop_times";
    readonly requirement: "optional";
}, {
    readonly fileName: "fare_attributes.txt";
    readonly tableName: "fare_attributes";
    readonly requirement: "optional";
}, {
    readonly fileName: "fare_media.txt";
    readonly tableName: "fare_media";
    readonly requirement: "optional";
}, {
    readonly fileName: "fare_products.txt";
    readonly tableName: "fare_products";
    readonly requirement: "optional";
}, {
    readonly fileName: "fare_leg_rules.txt";
    readonly tableName: "fare_leg_rules";
    readonly requirement: "optional";
}, {
    readonly fileName: "fare_transfer_rules.txt";
    readonly tableName: "fare_transfer_rules";
    readonly requirement: "optional";
}, {
    readonly fileName: "fare_capping_rules.txt";
    readonly tableName: "fare_capping_rules";
    readonly requirement: "optional";
}, {
    readonly fileName: "areas.txt";
    readonly tableName: "areas";
    readonly requirement: "optional";
}, {
    readonly fileName: "stop_areas.txt";
    readonly tableName: "stop_areas";
    readonly requirement: "optional";
}, {
    readonly fileName: "networks.txt";
    readonly tableName: "networks";
    readonly requirement: "optional";
}, {
    readonly fileName: "route_networks.txt";
    readonly tableName: "route_networks";
    readonly requirement: "optional";
}, {
    readonly fileName: "calendar.txt";
    readonly tableName: "calendar";
    readonly requirement: "optional";
}, {
    readonly fileName: "calendar_dates.txt";
    readonly tableName: "calendar_dates";
    readonly requirement: "optional";
}, {
    readonly fileName: "timeframes.txt";
    readonly tableName: "timeframes";
    readonly requirement: "optional";
}, {
    readonly fileName: "rider_categories.txt";
    readonly tableName: "rider_categories";
    readonly requirement: "optional";
}, {
    readonly fileName: "transfers.txt";
    readonly tableName: "transfers";
    readonly requirement: "optional";
}, {
    readonly fileName: "pathways.txt";
    readonly tableName: "pathways";
    readonly requirement: "optional";
}, {
    readonly fileName: "locations.txt";
    readonly tableName: "locations";
    readonly requirement: "optional";
}, {
    readonly fileName: "booking_rules.txt";
    readonly tableName: "booking_rules";
    readonly requirement: "optional";
}, {
    readonly fileName: "translations.txt";
    readonly tableName: "translations";
    readonly requirement: "optional";
}, {
    readonly fileName: "feed_info.txt";
    readonly tableName: "feed_info";
    readonly requirement: "optional";
}, {
    readonly fileName: "attributions.txt";
    readonly tableName: "attributions";
    readonly requirement: "optional";
}, {
    readonly fileName: "shapes.txt";
    readonly tableName: "shapes";
    readonly requirement: "optional";
}, {
    readonly fileName: "vehicle_types.txt";
    readonly tableName: "vehicle_types";
    readonly requirement: "optional";
}, {
    readonly fileName: "facilities.txt";
    readonly tableName: "facilities";
    readonly requirement: "optional";
}];
export type GtfsV4FileName = (typeof GTFS_V4_TABLE_SPECS)[number]["fileName"];
export type GtfsV4TableName = (typeof GTFS_V4_TABLE_SPECS)[number]["tableName"];
export declare const GTFS_V4_TABLE_NAMES: readonly GtfsV4TableName[];
export declare const isGtfsV4TableName: (value: string) => value is GtfsV4TableName;
export type GtfsScalar = string | number | null | undefined;
export type GtfsRow = Record<string, GtfsScalar>;
export interface AgencyRow extends GtfsRow {
    agency_id?: string | null;
    agency_name: string;
    agency_url?: string | null;
    agency_timezone?: string | null;
    agency_lang?: string | null;
    agency_phone?: string | null;
}
export interface LevelRow extends GtfsRow {
    level_id: string;
    level_index: number;
    level_name?: string | null;
}
export interface StopRow extends GtfsRow {
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
    location_type?: number | null;
    parent_station?: string | null;
    level_id?: string | null;
}
export interface RouteRow extends GtfsRow {
    route_id: string;
    agency_id?: string | null;
    route_short_name?: string | null;
    route_long_name?: string | null;
    route_type: number;
}
export interface RoutePatternRow extends GtfsRow {
    route_pattern_id: string;
    route_id: string;
}
export interface TripRow extends GtfsRow {
    trip_id: string;
    route_id: string;
    service_id: string;
}
export interface StopTimeRow extends GtfsRow {
    trip_id: string;
    stop_sequence: number;
    stop_id: string;
    arrival_time?: string | null;
    departure_time?: string | null;
}
export interface CalendarRow extends GtfsRow {
    service_id: string;
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
    start_date: string;
    end_date: string;
}
export interface CalendarDateRow extends GtfsRow {
    service_id: string;
    date: string;
    exception_type: number;
}
export interface GtfsV4TypedRows {
    agency: AgencyRow;
    levels: LevelRow;
    stops: StopRow;
    routes: RouteRow;
    route_patterns: RoutePatternRow;
    trips: TripRow;
    stop_times: StopTimeRow;
    calendar: CalendarRow;
    calendar_dates: CalendarDateRow;
}
export type GtfsV4TableRow<TName extends GtfsV4TableName> = TName extends keyof GtfsV4TypedRows ? GtfsV4TypedRows[TName] : GtfsRow;
//# sourceMappingURL=index.d.ts.map