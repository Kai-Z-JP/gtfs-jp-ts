import type { GtfsJpV4TableName, GtfsJpV4TableRow, GtfsRow } from "@gtfs-jp/types";

import type { SqlBindMap, SqlBindValue } from "./sql-types.js";

export type MaterializationSource = "gtfs-jp-v4";
export type DerivedColumnKind = "string" | "number";
export type DerivedTableState = "queued" | "running" | "done" | "skipped" | "error";
export type DerivedTableErrorPolicy = "fail" | "skip";

export type DerivedColumnDefinition = {
  kind: DerivedColumnKind;
  nullable?: boolean;
};

export type DerivedColumnDefinitions = Record<string, DerivedColumnDefinition>;

export type DerivedIndexDefinition<TColumnName extends string = string> = {
  name?: string;
  columns: readonly TColumnName[];
  unique?: boolean;
};

export type DerivedBuilderProgress = {
  message: string;
  state?: DerivedTableState;
  rowsWritten?: number;
};

export type DerivedBuildContext<TRuntime extends Record<string, unknown> = Record<string, unknown>> = {
  runtime: TRuntime;
  exec: (sql: string, bind?: SqlBindMap) => Promise<void>;
  query: <TRow extends GtfsRow = GtfsRow>(sql: string, bind?: SqlBindMap) => Promise<TRow[]>;
  emitProgress: (progress: DerivedBuilderProgress) => void;
};

type DerivedColumnValue<TColumn extends DerivedColumnDefinition> = TColumn["kind"] extends "number"
  ? TColumn["nullable"] extends false
    ? number
    : number | null
  : TColumn["nullable"] extends false
    ? string
    : string | null;

export type DerivedTableRow<TColumns extends DerivedColumnDefinitions> = {
  [TColumnName in Extract<keyof TColumns, string>]-?: DerivedColumnValue<TColumns[TColumnName]>;
};

export type DerivedRowIterable<TColumns extends DerivedColumnDefinitions> =
  | Iterable<DerivedTableRow<TColumns>>
  | AsyncIterable<DerivedTableRow<TColumns>>;

export type DerivedSqlBuild<TRuntime extends Record<string, unknown> = Record<string, unknown>> = {
  kind: "sql";
  selectSql: string;
  bind?: SqlBindMap | ((context: DerivedBuildContext<TRuntime>) => SqlBindMap | Promise<SqlBindMap>);
};

export type DerivedSqlScriptBuild<TRuntime extends Record<string, unknown> = Record<string, unknown>> = {
  kind: "sqlScript";
  statements:
    | readonly string[]
    | ((context: DerivedBuildContext<TRuntime>) => readonly string[] | Promise<readonly string[]>);
};

export type DerivedJsBuild<
  TColumns extends DerivedColumnDefinitions = DerivedColumnDefinitions,
  TRuntime extends Record<string, unknown> = Record<string, unknown>,
> = {
  kind: "js";
  batchSize?: number;
  run: (
    context: DerivedBuildContext<TRuntime>,
  ) => DerivedRowIterable<TColumns> | Promise<DerivedRowIterable<TColumns>>;
};

export type DerivedTableBuild<
  TColumns extends DerivedColumnDefinitions = DerivedColumnDefinitions,
  TRuntime extends Record<string, unknown> = Record<string, unknown>,
> = DerivedSqlBuild<TRuntime> | DerivedSqlScriptBuild<TRuntime> | DerivedJsBuild<TColumns, TRuntime>;

export type DerivedTableDefinition<
  TName extends string = string,
  TColumns extends DerivedColumnDefinitions = DerivedColumnDefinitions,
  TRuntime extends Record<string, unknown> = Record<string, unknown>,
> = {
  name: TName;
  dependsOn?: readonly string[];
  columns: TColumns;
  primaryKey?: readonly Extract<keyof TColumns, string>[];
  indexes?: readonly DerivedIndexDefinition<Extract<keyof TColumns, string>>[];
  onError?: DerivedTableErrorPolicy;
  build: DerivedTableBuild<TColumns, TRuntime>;
};

export type GtfsSchemaDefinition<
  TRuntime extends Record<string, unknown> = Record<string, unknown>,
  TDerivedTables extends readonly DerivedTableDefinition<any, any, any>[] = readonly DerivedTableDefinition<
    any,
    any,
    any
  >[],
> = {
  sources?: MaterializationSource;
  derivedTables?: TDerivedTables;
};

export type GtfsSchemaRuntime<TSchema extends GtfsSchemaDefinition> =
  TSchema extends GtfsSchemaDefinition<infer TRuntime, any> ? TRuntime : Record<string, unknown>;

export type DerivedTableName<TSchema extends GtfsSchemaDefinition> = NonNullable<
  TSchema["derivedTables"]
>[number]["name"];

export type GtfsSchemaTableName<TSchema extends GtfsSchemaDefinition> =
  | GtfsJpV4TableName
  | DerivedTableName<TSchema>;

type DerivedTableByName<
  TSchema extends GtfsSchemaDefinition,
  TName extends string,
> = Extract<NonNullable<TSchema["derivedTables"]>[number], { name: TName }>;

export type GtfsSchemaTableRow<
  TSchema extends GtfsSchemaDefinition,
  TName extends GtfsSchemaTableName<TSchema>,
> = TName extends GtfsJpV4TableName
  ? GtfsJpV4TableRow<TName>
  : DerivedTableRow<DerivedTableByName<TSchema, Extract<TName, string>>["columns"]>;
