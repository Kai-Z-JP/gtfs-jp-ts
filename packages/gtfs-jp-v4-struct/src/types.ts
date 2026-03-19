import type { GTFS_JP_V4_SCHEMA, GtfsJpV4ColumnSchema, GtfsJpV4Requirement } from "./schema.js";

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

export type GtfsJpV4SchemaEntry = (typeof GTFS_JP_V4_SCHEMA)[number];
export type GtfsJpV4TableName = GtfsJpV4SchemaEntry["tableName"];
export type GtfsJpV4FileName = GtfsJpV4SchemaEntry["fileName"];
export type GtfsJpV4Format = Extract<GtfsJpV4SchemaEntry, { format: unknown }>["format"];
export type GtfsJpV4TableRequirement = GtfsJpV4Requirement;

export type GtfsJpV4SchemaEntryByName<TName extends GtfsJpV4TableName> = Extract<
  GtfsJpV4SchemaEntry,
  { tableName: TName }
>;

export type GtfsJpV4ColumnsByTableName<TName extends GtfsJpV4TableName> =
  GtfsJpV4SchemaEntryByName<TName>["columns"];

type ValueFromColumn<C extends GtfsJpV4ColumnSchema> = C["values"] extends readonly (infer TValue)[]
  ? TValue
  : C["kind"] extends "number"
    ? number
    : string;

type ColumnNames<TColumns extends Record<string, GtfsJpV4ColumnSchema>> = Extract<keyof TColumns, string>;

type RequiredColumnNames<TColumns extends Record<string, GtfsJpV4ColumnSchema>> = {
  [K in ColumnNames<TColumns>]: TColumns[K]["required"] extends true ? K : never;
}[ColumnNames<TColumns>];

type OptionalColumnNames<TColumns extends Record<string, GtfsJpV4ColumnSchema>> = Exclude<
  ColumnNames<TColumns>,
  RequiredColumnNames<TColumns>
>;

export type RowFromColumns<TColumns extends Record<string, GtfsJpV4ColumnSchema>> = GtfsRow & {
  [K in RequiredColumnNames<TColumns>]: ValueFromColumn<TColumns[K]>;
} & {
  [K in OptionalColumnNames<TColumns>]?: ValueFromColumn<TColumns[K]>;
};

export type GtfsJpV4TableRow<TName extends GtfsJpV4TableName> = RowFromColumns<
  GtfsJpV4ColumnsByTableName<TName>
>;

export type GtfsJpV4TypedRows = {
  [TName in GtfsJpV4TableName]: GtfsJpV4TableRow<TName>;
};
