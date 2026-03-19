export const GTFS_V4_TABLE_SPECS = [
    { fileName: "agency.txt", tableName: "agency", requirement: "required" },
    { fileName: "levels.txt", tableName: "levels", requirement: "required" },
    { fileName: "stops.txt", tableName: "stops", requirement: "required" },
    {
        fileName: "locations.geojson",
        tableName: "locations_geojson",
        requirement: "recommended",
    },
    { fileName: "routes.txt", tableName: "routes", requirement: "recommended" },
    {
        fileName: "route_patterns.txt",
        tableName: "route_patterns",
        requirement: "recommended",
    },
    { fileName: "trips.txt", tableName: "trips", requirement: "optional" },
    {
        fileName: "frequencies.txt",
        tableName: "frequencies",
        requirement: "optional",
    },
    {
        fileName: "stop_times.txt",
        tableName: "stop_times",
        requirement: "optional",
    },
    {
        fileName: "fare_attributes.txt",
        tableName: "fare_attributes",
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
        fileName: "fare_transfer_rules.txt",
        tableName: "fare_transfer_rules",
        requirement: "optional",
    },
    {
        fileName: "fare_capping_rules.txt",
        tableName: "fare_capping_rules",
        requirement: "optional",
    },
    { fileName: "areas.txt", tableName: "areas", requirement: "optional" },
    {
        fileName: "stop_areas.txt",
        tableName: "stop_areas",
        requirement: "optional",
    },
    { fileName: "networks.txt", tableName: "networks", requirement: "optional" },
    {
        fileName: "route_networks.txt",
        tableName: "route_networks",
        requirement: "optional",
    },
    { fileName: "calendar.txt", tableName: "calendar", requirement: "optional" },
    {
        fileName: "calendar_dates.txt",
        tableName: "calendar_dates",
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
    { fileName: "transfers.txt", tableName: "transfers", requirement: "optional" },
    { fileName: "pathways.txt", tableName: "pathways", requirement: "optional" },
    {
        fileName: "locations.txt",
        tableName: "locations",
        requirement: "optional",
    },
    {
        fileName: "booking_rules.txt",
        tableName: "booking_rules",
        requirement: "optional",
    },
    {
        fileName: "translations.txt",
        tableName: "translations",
        requirement: "optional",
    },
    { fileName: "feed_info.txt", tableName: "feed_info", requirement: "optional" },
    {
        fileName: "attributions.txt",
        tableName: "attributions",
        requirement: "optional",
    },
    { fileName: "shapes.txt", tableName: "shapes", requirement: "optional" },
    {
        fileName: "vehicle_types.txt",
        tableName: "vehicle_types",
        requirement: "optional",
    },
    {
        fileName: "facilities.txt",
        tableName: "facilities",
        requirement: "optional",
    },
];
export const GTFS_V4_TABLE_NAMES = GTFS_V4_TABLE_SPECS.map((table) => table.tableName);
const gtfsV4TableNameSet = new Set(GTFS_V4_TABLE_NAMES);
export const isGtfsV4TableName = (value) => gtfsV4TableNameSet.has(value);
//# sourceMappingURL=index.js.map