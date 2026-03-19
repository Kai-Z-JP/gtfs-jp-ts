export type GtfsJpV4Requirement =
  | "required"
  | "conditional_required"
  | "recommended"
  | "optional"
  | "conditional_forbidden";

export type GtfsJpV4ColumnRequirement =
  | "required"
  | "conditional_required"
  | "recommended"
  | "optional"
  | "conditional_forbidden"
  | "not_used";

export type GtfsJpV4ColumnSchema = {
  required?: true;
  requirement?: GtfsJpV4ColumnRequirement;
  kind?: "string" | "number";
  values?: readonly (string | number)[];
};

export type GtfsJpV4TableSchema = {
  fileName: string;
  tableName: string;
  requirement: GtfsJpV4Requirement;
  format?: "txt" | "geojson";
  columns: Record<string, GtfsJpV4ColumnSchema>;
};

const s = () => ({ kind: "string", requirement: "optional" } as const);
const rs = () => ({ kind: "string", required: true, requirement: "required" } as const);
const cs = () => ({ kind: "string", requirement: "conditional_required" } as const);
const cfs = () => ({ kind: "string", requirement: "conditional_forbidden" } as const);
const recs = () => ({ kind: "string", requirement: "recommended" } as const);
const nus = () => ({ kind: "string", requirement: "not_used" } as const);
const n = () => ({ kind: "number", requirement: "optional" } as const);
const rn = () => ({ kind: "number", required: true, requirement: "required" } as const);
const cn = () => ({ kind: "number", requirement: "conditional_required" } as const);
const e = <const T extends readonly (string | number)[]>(values: T) => ({
  values,
  requirement: "optional",
} as const);
const re = <const T extends readonly (string | number)[]>(values: T) => ({
  values,
  required: true,
  requirement: "required",
} as const);
const ce = <const T extends readonly (string | number)[]>(values: T) => ({
  values,
  requirement: "conditional_required",
} as const);
const rece = <const T extends readonly (string | number)[]>(values: T) => ({
  values,
  requirement: "recommended",
} as const);
const cfe = <const T extends readonly (string | number)[]>(values: T) => ({
  values,
  requirement: "conditional_forbidden",
} as const);

// Based on GTFS JP v4 draft specification (2025-10-01 draft release).
export const GTFS_JP_V4_SCHEMA = [
  {
    fileName: "feed_info.txt",
    tableName: "feed_info",
    requirement: "required",
    columns: {
      feed_publisher_name: rs(),
      feed_publisher_url: rs(),
      feed_lang: rs(),
      default_lang: s(),
      feed_start_date: rs(),
      feed_end_date: rs(),
      feed_version: rs(),
      feed_contact_email: s(),
      feed_contact_url: s(),
    },
  },
  {
    fileName: "agency.txt",
    tableName: "agency",
    requirement: "required",
    columns: {
      agency_id: rs(),
      agency_name: rs(),
      agency_url: rs(),
      agency_timezone: rs(),
      agency_lang: rs(),
      agency_phone: s(),
      agency_fare_url: s(),
      agency_email: s(),
    },
  },
  {
    fileName: "stops.txt",
    tableName: "stops",
    requirement: "required",
    columns: {
      stop_id: rs(),
      stop_code: s(),
      stop_name: cs(),
      tts_stop_name: nus(),
      stop_desc: s(),
      stop_lat: cn(),
      stop_lon: cn(),
      zone_id: cs(),
      stop_url: s(),
      location_type: n(),
      parent_station: cs(),
      stop_timezone: s(),
      wheelchair_boarding: e([0, 1, 2] as const),
      level_id: s(),
      platform_code: recs(),
    },
  },
  {
    fileName: "routes.txt",
    tableName: "routes",
    requirement: "required",
    columns: {
      route_id: rs(),
      agency_id: rs(),
      route_short_name: cs(),
      route_long_name: cs(),
      route_desc: s(),
      route_type: rn(),
      route_url: s(),
      route_color: recs(),
      route_text_color: recs(),
      route_sort_order: n(),
      continuous_pickup: cfe([0, 1, 2, 3] as const),
      continuous_drop_off: cfe([0, 1, 2, 3] as const),
      network_id: nus(),
      jp_parent_route_id: s(),
    },
  },
  {
    fileName: "trips.txt",
    tableName: "trips",
    requirement: "required",
    columns: {
      route_id: rs(),
      service_id: rs(),
      trip_id: rs(),
      trip_headsign: s(),
      trip_short_name: s(),
      direction_id: ce([0, 1] as const),
      block_id: s(),
      shape_id: cs(),
      wheelchair_accessible: e([0, 1, 2, 3, 4] as const),
      bikes_allowed: e([0, 1, 2] as const),
      cars_allowed: e([0, 1, 2] as const),
      jp_trip_desc: s(),
      jp_trip_desc_symbol: s(),
      jp_pattern_id: s(),
      jp_office_id: s(),
    },
  },
  {
    fileName: "stop_times.txt",
    tableName: "stop_times",
    requirement: "required",
    columns: {
      trip_id: rs(),
      arrival_time: cs(),
      departure_time: cs(),
      stop_id: cs(),
      location_group_id: cfs(),
      location_id: cfs(),
      stop_sequence: rn(),
      stop_headsign: s(),
      pickup_type: cfe([0, 1, 2, 3] as const),
      drop_off_type: cfe([0, 1, 2, 3] as const),
      continuous_pickup: cfe([0, 1, 2, 3] as const),
      continuous_drop_off: cfe([0, 1, 2, 3] as const),
      shape_dist_traveled: n(),
      timepoint: rece([0, 1] as const),
      start_pickup_drop_off_window: cs(),
      end_pickup_drop_off_window: cs(),
      pickup_booking_rule_id: s(),
      drop_off_booking_rule_id: s(),
    },
  },
  {
    fileName: "calendar.txt",
    tableName: "calendar",
    requirement: "required",
    columns: {
      service_id: rs(),
      monday: re([0, 1] as const),
      tuesday: re([0, 1] as const),
      wednesday: re([0, 1] as const),
      thursday: re([0, 1] as const),
      friday: re([0, 1] as const),
      saturday: re([0, 1] as const),
      sunday: re([0, 1] as const),
      start_date: rs(),
      end_date: rs(),
    },
  },
  {
    fileName: "calendar_dates.txt",
    tableName: "calendar_dates",
    requirement: "conditional_required",
    columns: {
      service_id: rs(),
      date: rs(),
      exception_type: re([1, 2] as const),
    },
  },
  {
    fileName: "fare_attributes.txt",
    tableName: "fare_attributes",
    requirement: "required",
    columns: {
      fare_id: rs(),
      price: rn(),
      currency_type: rs(),
      payment_method: re([0, 1] as const),
      transfers: re([0, 1, 2] as const),
      agency_id: rs(),
      transfer_duration: n(),
      ic_price: n(),
    },
  },
  {
    fileName: "fare_rules.txt",
    tableName: "fare_rules",
    requirement: "conditional_required",
    columns: {
      fare_id: rs(),
      route_id: s(),
      origin_id: s(),
      destination_id: s(),
      contains_id: s(),
    },
  },
  {
    fileName: "translations.txt",
    tableName: "translations",
    requirement: "required",
    columns: {
      table_name: rs(),
      field_name: rs(),
      language: rs(),
      translation: rs(),
      record_id: s(),
      record_sub_id: s(),
      field_value: s(),
    },
  },
  {
    fileName: "shapes.txt",
    tableName: "shapes",
    requirement: "recommended",
    columns: {
      shape_id: rs(),
      shape_pt_lat: rn(),
      shape_pt_lon: rn(),
      shape_pt_sequence: rn(),
      shape_dist_traveled: n(),
    },
  },
  {
    fileName: "attributions.txt",
    tableName: "attributions",
    requirement: "recommended",
    columns: {
      attribution_id: s(),
      agency_id: s(),
      route_id: s(),
      trip_id: s(),
      organization_name: rs(),
      is_producer: ce([0, 1] as const),
      is_operator: ce([0, 1] as const),
      is_authority: ce([0, 1] as const),
      attribution_url: s(),
      attribution_email: s(),
      attribution_phone: s(),
    },
  },
  {
    fileName: "transfers.txt",
    tableName: "transfers",
    requirement: "recommended",
    columns: {
      from_stop_id: cs(),
      to_stop_id: cs(),
      from_route_id: s(),
      to_route_id: s(),
      from_trip_id: cs(),
      to_trip_id: cs(),
      transfer_type: re([0, 1, 2, 3, 4, 5] as const),
      min_transfer_time: cn(),
    },
  },
  {
    fileName: "frequencies.txt",
    tableName: "frequencies",
    requirement: "optional",
    columns: {
      trip_id: rs(),
      start_time: rs(),
      end_time: rs(),
      headway_secs: rn(),
      exact_times: e([0, 1] as const),
    },
  },
  {
    fileName: "pathways.txt",
    tableName: "pathways",
    requirement: "optional",
    columns: {
      pathway_id: rs(),
      from_stop_id: rs(),
      to_stop_id: rs(),
      pathway_mode: re([1, 2, 3, 4, 5, 6, 7] as const),
      is_bidirectional: re([0, 1] as const),
      length: n(),
      traversal_time: n(),
      stair_count: n(),
      max_slope: n(),
      min_width: n(),
      signposted_as: s(),
      reversed_signposted_as: s(),
    },
  },
  {
    fileName: "levels.txt",
    tableName: "levels",
    requirement: "optional",
    columns: {
      level_id: rs(),
      level_index: rn(),
      level_name: s(),
    },
  },
  {
    fileName: "location_groups.txt",
    tableName: "location_groups",
    requirement: "optional",
    columns: {
      location_group_id: rs(),
      location_group_name: s(),
    },
  },
  {
    fileName: "location_group_stops.txt",
    tableName: "location_group_stops",
    requirement: "optional",
    columns: {
      location_group_id: rs(),
      stop_id: rs(),
    },
  },
  {
    fileName: "locations.geojson",
    tableName: "locations_geojson",
    requirement: "optional",
    format: "geojson",
    columns: {},
  },
  {
    fileName: "booking_rules.txt",
    tableName: "booking_rules",
    requirement: "optional",
    columns: {
      booking_rule_id: rs(),
      booking_type: re([0, 1, 2] as const),
      prior_notice_duration_min: n(),
      prior_notice_duration_max: n(),
      prior_notice_last_day: n(),
      prior_notice_last_time: s(),
      prior_notice_start_day: n(),
      prior_notice_start_time: s(),
      prior_notice_service_id: s(),
      message: s(),
      pickup_message: s(),
      drop_off_message: s(),
      phone_number: s(),
      info_url: s(),
      booking_url: s(),
    },
  },
  {
    fileName: "timeframes.txt",
    tableName: "timeframes",
    requirement: "optional",
    columns: {
      timeframe_group_id: rs(),
      start_time: cs(),
      end_time: cs(),
      service_id: rs(),
    },
  },
  {
    fileName: "rider_categories.txt",
    tableName: "rider_categories",
    requirement: "optional",
    columns: {
      rider_category_id: rs(),
      rider_category_name: rs(),
      is_default_fare_category: re([0, 1] as const),
      eligibility_url: s(),
    },
  },
  {
    fileName: "fare_media.txt",
    tableName: "fare_media",
    requirement: "optional",
    columns: {
      fare_media_id: rs(),
      fare_media_name: s(),
      fare_media_type: re([0, 1, 2, 3, 4] as const),
    },
  },
  {
    fileName: "fare_products.txt",
    tableName: "fare_products",
    requirement: "optional",
    columns: {
      fare_product_id: rs(),
      fare_product_name: s(),
      rider_category_id: s(),
      fare_media_id: s(),
      amount: rn(),
      currency: rs(),
    },
  },
  {
    fileName: "fare_leg_rules.txt",
    tableName: "fare_leg_rules",
    requirement: "optional",
    columns: {
      leg_group_id: s(),
      network_id: s(),
      from_area_id: s(),
      to_area_id: s(),
      from_timeframe_group_id: s(),
      to_timeframe_group_id: s(),
      fare_product_id: rs(),
      rule_priority: n(),
    },
  },
  {
    fileName: "fare_leg_join_rules.txt",
    tableName: "fare_leg_join_rules",
    requirement: "optional",
    columns: {
      from_network_id: rs(),
      to_network_id: rs(),
      from_stop_id: cs(),
      to_stop_id: cs(),
    },
  },
  {
    fileName: "fare_transfer_rules.txt",
    tableName: "fare_transfer_rules",
    requirement: "optional",
    columns: {
      from_leg_group_id: s(),
      to_leg_group_id: s(),
      transfer_count: n(),
      duration_limit: n(),
      duration_limit_type: ce([0, 1, 2, 3] as const),
      fare_transfer_type: re([0, 1, 2] as const),
      fare_product_id: s(),
    },
  },
  {
    fileName: "areas.txt",
    tableName: "areas",
    requirement: "optional",
    columns: {
      area_id: rs(),
      area_name: s(),
    },
  },
  {
    fileName: "stop_areas.txt",
    tableName: "stop_areas",
    requirement: "optional",
    columns: {
      area_id: rs(),
      stop_id: rs(),
    },
  },
  {
    fileName: "networks.txt",
    tableName: "networks",
    requirement: "conditional_forbidden",
    columns: {
      network_id: rs(),
      network_name: s(),
    },
  },
  {
    fileName: "route_networks.txt",
    tableName: "route_networks",
    requirement: "conditional_forbidden",
    columns: {
      network_id: rs(),
      route_id: rs(),
    },
  },
  // Legacy GTFS-JP v3 extensions kept for backward compatibility.
  {
    fileName: "agency_jp.txt",
    tableName: "agency_jp",
    requirement: "optional",
    columns: {
      agency_id: rs(),
      agency_official_name: s(),
      agency_zip_number: s(),
      agency_address: s(),
      agency_president_pos: s(),
      agency_president_name: s(),
    },
  },
  {
    fileName: "office_jp.txt",
    tableName: "office_jp",
    requirement: "optional",
    columns: {
      office_id: rs(),
      office_name: rs(),
      office_url: s(),
      office_phone: s(),
    },
  },
  {
    fileName: "pattern_jp.txt",
    tableName: "pattern_jp",
    requirement: "optional",
    columns: {
      jp_pattern_id: rs(),
      route_update_date: s(),
      origin_stop: s(),
      via_stop: s(),
      destination_stop: s(),
    },
  },
] as const satisfies readonly GtfsJpV4TableSchema[];
