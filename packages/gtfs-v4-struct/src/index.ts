export type GtfsV4Requirement =
  | "required"
  | "conditional_required"
  | "recommended"
  | "optional"
  | "conditional_forbidden";

export interface GtfsV4TableSpec<
  Name extends string = string,
  FileName extends string = string,
> {
  fileName: FileName;
  tableName: Name;
  requirement: GtfsV4Requirement;
}

// Based on GTFS JP v4 draft specification (2025-10-01 draft release).
export const GTFS_V4_TABLE_SPECS = [
  { fileName: "feed_info.txt", tableName: "feed_info", requirement: "required" },
  { fileName: "agency.txt", tableName: "agency", requirement: "required" },
  { fileName: "stops.txt", tableName: "stops", requirement: "required" },
  { fileName: "routes.txt", tableName: "routes", requirement: "required" },
  { fileName: "trips.txt", tableName: "trips", requirement: "required" },
  {
    fileName: "stop_times.txt",
    tableName: "stop_times",
    requirement: "required",
  },
  { fileName: "calendar.txt", tableName: "calendar", requirement: "required" },
  {
    fileName: "calendar_dates.txt",
    tableName: "calendar_dates",
    requirement: "conditional_required",
  },
  {
    fileName: "fare_attributes.txt",
    tableName: "fare_attributes",
    requirement: "required",
  },
  {
    fileName: "fare_rules.txt",
    tableName: "fare_rules",
    requirement: "conditional_required",
  },
  {
    fileName: "translations.txt",
    tableName: "translations",
    requirement: "required",
  },
  { fileName: "shapes.txt", tableName: "shapes", requirement: "recommended" },
  {
    fileName: "attributions.txt",
    tableName: "attributions",
    requirement: "recommended",
  },
  {
    fileName: "transfers.txt",
    tableName: "transfers",
    requirement: "recommended",
  },
  {
    fileName: "frequencies.txt",
    tableName: "frequencies",
    requirement: "optional",
  },
  { fileName: "pathways.txt", tableName: "pathways", requirement: "optional" },
  { fileName: "levels.txt", tableName: "levels", requirement: "optional" },
  {
    fileName: "location_groups.txt",
    tableName: "location_groups",
    requirement: "optional",
  },
  {
    fileName: "location_group_stops.txt",
    tableName: "location_group_stops",
    requirement: "optional",
  },
  {
    fileName: "locations.geojson",
    tableName: "locations_geojson",
    requirement: "optional",
  },
  {
    fileName: "booking_rules.txt",
    tableName: "booking_rules",
    requirement: "optional",
  },
  {
    fileName: "timeframes.txt",
    tableName: "timeframes",
    requirement: "optional",
  },
  {
    fileName: "rider_categories.txt",
    tableName: "rider_categories",
    requirement: "optional",
  },
  {
    fileName: "fare_media.txt",
    tableName: "fare_media",
    requirement: "optional",
  },
  {
    fileName: "fare_products.txt",
    tableName: "fare_products",
    requirement: "optional",
  },
  {
    fileName: "fare_leg_rules.txt",
    tableName: "fare_leg_rules",
    requirement: "optional",
  },
  {
    fileName: "fare_leg_join_rules.txt",
    tableName: "fare_leg_join_rules",
    requirement: "optional",
  },
  {
    fileName: "fare_transfer_rules.txt",
    tableName: "fare_transfer_rules",
    requirement: "optional",
  },
  { fileName: "areas.txt", tableName: "areas", requirement: "optional" },
  {
    fileName: "stop_areas.txt",
    tableName: "stop_areas",
    requirement: "optional",
  },
  {
    fileName: "networks.txt",
    tableName: "networks",
    requirement: "conditional_forbidden",
  },
  {
    fileName: "route_networks.txt",
    tableName: "route_networks",
    requirement: "conditional_forbidden",
  },
] as const satisfies readonly GtfsV4TableSpec[];

export type GtfsV4FileName = (typeof GTFS_V4_TABLE_SPECS)[number]["fileName"];
export type GtfsV4TableName = (typeof GTFS_V4_TABLE_SPECS)[number]["tableName"];

export const GTFS_V4_TABLE_NAMES = GTFS_V4_TABLE_SPECS.map(
  (table) => table.tableName,
) as readonly GtfsV4TableName[];

const gtfsV4TableNameSet = new Set<string>(GTFS_V4_TABLE_NAMES);

export const isGtfsV4TableName = (value: string): value is GtfsV4TableName =>
  gtfsV4TableNameSet.has(value);

export type GtfsScalar = string | number | null | undefined;
export type GtfsRow = Record<string, GtfsScalar>;

export type GtfsId = string;
export type GtfsText = string;
export type GtfsDate = string;
export type GtfsTime = string;
export type GtfsUrl = string;
export type GtfsEmail = string;
export type GtfsPhoneNumber = string;
export type GtfsTimezone = string;
export type GtfsLanguageCode = string;
export type GtfsCurrencyCode = string;
export type GtfsColor = string;

export type BinaryFlag = 0 | 1;

export interface FeedInfoRow extends GtfsRow {
  feed_publisher_name: GtfsText;
  feed_publisher_url: GtfsUrl;
  feed_lang: GtfsLanguageCode;
  default_lang?: GtfsLanguageCode;
  feed_start_date: GtfsDate;
  feed_end_date: GtfsDate;
  feed_version: GtfsText;
  feed_contact_email?: GtfsEmail;
  feed_contact_url?: GtfsUrl;
}

export interface AgencyRow extends GtfsRow {
  agency_id: GtfsId;
  agency_name: GtfsText;
  agency_url: GtfsUrl;
  agency_timezone: GtfsTimezone;
  agency_lang: GtfsLanguageCode;
  agency_phone?: GtfsPhoneNumber;
  agency_fare_url?: GtfsUrl;
  agency_email?: GtfsEmail;
}

export interface StopRow extends GtfsRow {
  stop_id: GtfsId;
  stop_code?: GtfsText;
  stop_name?: GtfsText;
  tts_stop_name?: GtfsText;
  stop_desc?: GtfsText;
  stop_lat?: number;
  stop_lon?: number;
  zone_id?: GtfsId;
  stop_url?: GtfsUrl;
  location_type?: number;
  parent_station?: GtfsId;
  stop_timezone?: GtfsTimezone;
  wheelchair_boarding?: 0 | 1 | 2;
  level_id?: GtfsId;
  platform_code?: GtfsText;
}

export interface RouteRow extends GtfsRow {
  route_id: GtfsId;
  agency_id: GtfsId;
  route_short_name?: GtfsText;
  route_long_name?: GtfsText;
  route_desc?: GtfsText;
  route_type: number;
  route_url?: GtfsUrl;
  route_color?: GtfsColor;
  route_text_color?: GtfsColor;
  route_sort_order?: number;
  continuous_pickup?: 0 | 1 | 2 | 3;
  continuous_drop_off?: 0 | 1 | 2 | 3;
  network_id?: GtfsId;
}

export interface TripRow extends GtfsRow {
  route_id: GtfsId;
  service_id: GtfsId;
  trip_id: GtfsId;
  trip_headsign?: GtfsText;
  trip_short_name?: GtfsText;
  direction_id?: 0 | 1;
  block_id?: GtfsId;
  shape_id?: GtfsId;
  wheelchair_accessible?: 0 | 1 | 2 | 3 | 4;
  bikes_allowed?: 0 | 1 | 2;
  cars_allowed?: 0 | 1 | 2;
  jp_trip_desc?: GtfsText;
  jp_trip_desc_symbol?: GtfsText;
  jp_pattern_id?: GtfsId;
}

export interface StopTimeRow extends GtfsRow {
  trip_id: GtfsId;
  arrival_time?: GtfsTime;
  departure_time?: GtfsTime;
  stop_id?: GtfsId;
  location_group_id?: GtfsId;
  location_id?: GtfsId;
  stop_sequence: number;
  stop_headsign?: GtfsText;
  pickup_type?: 0 | 1 | 2 | 3;
  drop_off_type?: 0 | 1 | 2 | 3;
  continuous_pickup?: 0 | 1 | 2 | 3;
  continuous_drop_off?: 0 | 1 | 2 | 3;
  shape_dist_traveled?: number;
  timepoint?: BinaryFlag;
  start_pickup_drop_off_window?: GtfsTime;
  end_pickup_drop_off_window?: GtfsTime;
  pickup_booking_rule_id?: GtfsId;
  drop_off_booking_rule_id?: GtfsId;
}

export interface CalendarRow extends GtfsRow {
  service_id: GtfsId;
  monday: BinaryFlag;
  tuesday: BinaryFlag;
  wednesday: BinaryFlag;
  thursday: BinaryFlag;
  friday: BinaryFlag;
  saturday: BinaryFlag;
  sunday: BinaryFlag;
  start_date: GtfsDate;
  end_date: GtfsDate;
}

export interface CalendarDateRow extends GtfsRow {
  service_id: GtfsId;
  date: GtfsDate;
  exception_type: 1 | 2;
}

export interface TranslationRow extends GtfsRow {
  table_name: GtfsText;
  field_name: GtfsText;
  language: GtfsLanguageCode;
  translation: GtfsText;
  record_id?: GtfsId;
  record_sub_id?: GtfsId;
  field_value?: GtfsText;
}

export interface FareAttributesRow extends GtfsRow {
  fare_id: GtfsId;
  price: number;
  currency_type: GtfsCurrencyCode;
  payment_method: 0 | 1;
  transfers: 0 | 1 | 2;
  agency_id: GtfsId;
  transfer_duration?: number;
  ic_price?: number;
}

export interface FareRulesRow extends GtfsRow {
  fare_id: GtfsId;
  route_id?: GtfsId;
  origin_id?: GtfsId;
  destination_id?: GtfsId;
  contains_id?: GtfsId;
}

export interface ShapeRow extends GtfsRow {
  shape_id: GtfsId;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
  shape_dist_traveled?: number;
}

export interface AttributionRow extends GtfsRow {
  attribution_id?: GtfsId;
  agency_id?: GtfsId;
  route_id?: GtfsId;
  trip_id?: GtfsId;
  organization_name: GtfsText;
  is_producer?: BinaryFlag;
  is_operator?: BinaryFlag;
  is_authority?: BinaryFlag;
  attribution_url?: GtfsUrl;
  attribution_email?: GtfsEmail;
  attribution_phone?: GtfsPhoneNumber;
}

export interface TransferRow extends GtfsRow {
  from_stop_id?: GtfsId;
  to_stop_id?: GtfsId;
  from_route_id?: GtfsId;
  to_route_id?: GtfsId;
  from_trip_id?: GtfsId;
  to_trip_id?: GtfsId;
  transfer_type: 0 | 1 | 2 | 3 | 4 | 5;
  min_transfer_time?: number;
}

export interface FrequencyRow extends GtfsRow {
  trip_id: GtfsId;
  start_time: GtfsTime;
  end_time: GtfsTime;
  headway_secs: number;
  exact_times?: BinaryFlag;
}

export interface PathwayRow extends GtfsRow {
  pathway_id: GtfsId;
  from_stop_id: GtfsId;
  to_stop_id: GtfsId;
  pathway_mode: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  is_bidirectional: BinaryFlag;
  length?: number;
  traversal_time?: number;
  stair_count?: number;
  max_slope?: number;
  min_width?: number;
  signposted_as?: GtfsText;
  reversed_signposted_as?: GtfsText;
}

export interface LevelRow extends GtfsRow {
  level_id: GtfsId;
  level_index: number;
  level_name?: GtfsText;
}

export interface LocationGroupRow extends GtfsRow {
  location_group_id: GtfsId;
  location_group_name?: GtfsText;
}

export interface LocationGroupStopRow extends GtfsRow {
  location_group_id: GtfsId;
  stop_id: GtfsId;
}

export interface BookingRuleRow extends GtfsRow {
  booking_rule_id: GtfsId;
  booking_type: 0 | 1 | 2;
  prior_notice_duration_min?: number;
  prior_notice_duration_max?: number;
  prior_notice_last_day?: number;
  prior_notice_last_time?: GtfsTime;
  prior_notice_start_day?: number;
  prior_notice_start_time?: GtfsTime;
  prior_notice_service_id?: GtfsId;
  message?: GtfsText;
  pickup_message?: GtfsText;
  drop_off_message?: GtfsText;
  phone_number?: GtfsPhoneNumber;
  info_url?: GtfsUrl;
  booking_url?: GtfsUrl;
}

export interface TimeframeRow extends GtfsRow {
  timeframe_group_id: GtfsId;
  start_time?: GtfsTime;
  end_time?: GtfsTime;
  service_id: GtfsId;
}

export interface RiderCategoryRow extends GtfsRow {
  rider_category_id: GtfsId;
  rider_category_name: GtfsText;
  is_default_fare_category: BinaryFlag;
  eligibility_url?: GtfsUrl;
}

export interface FareMediaRow extends GtfsRow {
  fare_media_id: GtfsId;
  fare_media_name?: GtfsText;
  fare_media_type: 0 | 1 | 2 | 3 | 4;
}

export interface FareProductRow extends GtfsRow {
  fare_product_id: GtfsId;
  fare_product_name?: GtfsText;
  rider_category_id?: GtfsId;
  fare_media_id?: GtfsId;
  amount: number;
  currency: GtfsCurrencyCode;
}

export interface FareLegRuleRow extends GtfsRow {
  leg_group_id?: GtfsId;
  network_id?: GtfsId;
  from_area_id?: GtfsId;
  to_area_id?: GtfsId;
  from_timeframe_group_id?: GtfsId;
  to_timeframe_group_id?: GtfsId;
  fare_product_id: GtfsId;
  rule_priority?: number;
}

export interface FareLegJoinRuleRow extends GtfsRow {
  from_network_id: GtfsId;
  to_network_id: GtfsId;
  from_stop_id?: GtfsId;
  to_stop_id?: GtfsId;
}

export interface FareTransferRuleRow extends GtfsRow {
  from_leg_group_id?: GtfsId;
  to_leg_group_id?: GtfsId;
  transfer_count?: -1 | number;
  duration_limit?: number;
  duration_limit_type?: 0 | 1 | 2 | 3;
  fare_transfer_type: 0 | 1 | 2;
  fare_product_id?: GtfsId;
}

export interface AreaRow extends GtfsRow {
  area_id: GtfsId;
  area_name?: GtfsText;
}

export interface StopAreaRow extends GtfsRow {
  area_id: GtfsId;
  stop_id: GtfsId;
}

export interface NetworkRow extends GtfsRow {
  network_id: GtfsId;
  network_name?: GtfsText;
}

export interface RouteNetworkRow extends GtfsRow {
  network_id: GtfsId;
  route_id: GtfsId;
}

export interface LocationsGeoJsonFeatureProperties {
  stop_name?: string;
  stop_desc?: string;
}

export interface LocationsGeoJsonFeature {
  type: "Feature";
  id: string;
  properties: LocationsGeoJsonFeatureProperties;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

export interface LocationsGeoJson {
  type: "FeatureCollection";
  features: LocationsGeoJsonFeature[];
}

export interface GtfsV4TypedRows {
  feed_info: FeedInfoRow;
  agency: AgencyRow;
  stops: StopRow;
  routes: RouteRow;
  trips: TripRow;
  stop_times: StopTimeRow;
  calendar: CalendarRow;
  calendar_dates: CalendarDateRow;
  translations: TranslationRow;
  fare_attributes: FareAttributesRow;
  fare_rules: FareRulesRow;
  shapes: ShapeRow;
  attributions: AttributionRow;
  transfers: TransferRow;
  frequencies: FrequencyRow;
  pathways: PathwayRow;
  levels: LevelRow;
  location_groups: LocationGroupRow;
  location_group_stops: LocationGroupStopRow;
  booking_rules: BookingRuleRow;
  timeframes: TimeframeRow;
  rider_categories: RiderCategoryRow;
  fare_media: FareMediaRow;
  fare_products: FareProductRow;
  fare_leg_rules: FareLegRuleRow;
  fare_leg_join_rules: FareLegJoinRuleRow;
  fare_transfer_rules: FareTransferRuleRow;
  areas: AreaRow;
  stop_areas: StopAreaRow;
  networks: NetworkRow;
  route_networks: RouteNetworkRow;
  locations_geojson: GtfsRow;
}

export type GtfsV4TableRow<TName extends GtfsV4TableName> =
  TName extends keyof GtfsV4TypedRows ? GtfsV4TypedRows[TName] : GtfsRow;
