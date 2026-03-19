import type { GTFS_V4_SCHEMA, GtfsV4ColumnSchema, GtfsV4Requirement } from "./schema.js";

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

export type GtfsV4SchemaEntry = (typeof GTFS_V4_SCHEMA)[number];
export type GtfsV4TableName = GtfsV4SchemaEntry["tableName"];
export type GtfsV4FileName = GtfsV4SchemaEntry["fileName"];
export type GtfsV4Format = Extract<GtfsV4SchemaEntry, { format: unknown }>["format"];
export type GtfsV4TableRequirement = GtfsV4Requirement;

export type GtfsV4SchemaEntryByName<TName extends GtfsV4TableName> = Extract<
  GtfsV4SchemaEntry,
  { tableName: TName }
>;

export type GtfsV4ColumnsByTableName<TName extends GtfsV4TableName> =
  GtfsV4SchemaEntryByName<TName>["columns"];

type ValueFromColumn<C extends GtfsV4ColumnSchema> = C["values"] extends readonly (infer TValue)[]
  ? TValue
  : C["kind"] extends "number"
    ? number
    : string;

type ColumnNames<TColumns extends Record<string, GtfsV4ColumnSchema>> = Extract<keyof TColumns, string>;

type RequiredColumnNames<TColumns extends Record<string, GtfsV4ColumnSchema>> = {
  [K in ColumnNames<TColumns>]: TColumns[K]["required"] extends true ? K : never;
}[ColumnNames<TColumns>];

type OptionalColumnNames<TColumns extends Record<string, GtfsV4ColumnSchema>> = Exclude<
  ColumnNames<TColumns>,
  RequiredColumnNames<TColumns>
>;

export type RowFromColumns<TColumns extends Record<string, GtfsV4ColumnSchema>> = GtfsRow & {
  [K in RequiredColumnNames<TColumns>]: ValueFromColumn<TColumns[K]>;
} & {
  [K in OptionalColumnNames<TColumns>]?: ValueFromColumn<TColumns[K]>;
};

export type GtfsV4TableRow<TName extends GtfsV4TableName> = RowFromColumns<
  GtfsV4ColumnsByTableName<TName>
>;

export type GtfsV4TypedRows = {
  [TName in GtfsV4TableName]: GtfsV4TableRow<TName>;
};
