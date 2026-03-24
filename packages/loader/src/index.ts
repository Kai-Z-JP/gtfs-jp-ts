export { createGtfsLoader } from './loader.js';
export { defineGtfsSchema, derivedTable } from './schema.js';

export type {
  CloseOptions,
  GtfsLoader,
  GtfsValidationResult,
  GtfsLoaderOptions,
  ImportGtfsZipOptions,
  ImportGtfsZipResult,
  ImportProgressEvent,
  ImportProgressPhase,
  ImportProgressTarget,
  ImportTargetKind,
  ImportTargetState,
  SqlBindMap,
  SqlBindValue,
  SqliteStorageMode,
} from './types.js';

export type {
  DerivedBuildContext,
  DerivedBuilderProgress,
  DerivedColumnDefinition,
  DerivedColumnDefinitions,
  DerivedColumnKind,
  DerivedIndexDefinition,
  DerivedJsBuild,
  DerivedSqlBuild,
  DerivedSqlScriptBuild,
  DerivedTableBuild,
  DerivedTableDefinition,
  DerivedTableErrorPolicy,
  DerivedTableName,
  DerivedTableRow,
  DerivedTableState,
  GtfsSchemaDefinition,
  GtfsSchemaRuntime,
  GtfsSchemaTableName,
  GtfsSchemaTableRow,
  MaterializationSource,
  SourceReadColumns,
  SourceReadOptions,
  SourceReadRow,
  WhereInput,
} from './schema-types.js';

export type { WhereExpr, WhereExprBuilder, WhereOp } from './where.js';
