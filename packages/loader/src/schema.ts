import type {
  DerivedColumnDefinitions,
  DerivedTableDefinition,
  GtfsSchemaDefinition,
  MaterializationSource,
} from "./schema-types.js";

export const derivedTable = <
  const TName extends string,
  const TColumns extends DerivedColumnDefinitions,
  TRuntime extends Record<string, unknown> = Record<string, unknown>,
>(
  definition: DerivedTableDefinition<TName, TColumns, TRuntime>,
): DerivedTableDefinition<TName, TColumns, TRuntime> => definition;

export const defineGtfsSchema = <
  TRuntime extends Record<string, unknown> = Record<string, unknown>,
  const TDerivedTables extends readonly DerivedTableDefinition<any, any, any>[] = readonly [],
>(
  definition: {
    sources?: MaterializationSource;
    derivedTables?: TDerivedTables;
  } = {},
): GtfsSchemaDefinition<TRuntime, TDerivedTables> => ({
  sources: definition.sources ?? "gtfs-jp-v4",
  derivedTables: definition.derivedTables ?? ([] as unknown as TDerivedTables),
});
