import { GTFS_V4_SCHEMA } from "./schema.js";
import type {
  GtfsV4FileName,
  GtfsV4SchemaEntry,
  GtfsV4SchemaEntryByName,
  GtfsV4TableName,
} from "./types.js";

export const GTFS_V4_TABLE_NAMES = GTFS_V4_SCHEMA.map(
  (schema) => schema.tableName,
) as readonly GtfsV4TableName[];

export const GTFS_V4_FILE_NAMES = GTFS_V4_SCHEMA.map(
  (schema) => schema.fileName,
) as readonly GtfsV4FileName[];

const schemaByTableName = new Map<GtfsV4TableName, GtfsV4SchemaEntry>(
  GTFS_V4_SCHEMA.map((schema) => [schema.tableName, schema]),
);

const schemaByFileName = new Map<GtfsV4FileName, GtfsV4SchemaEntry>(
  GTFS_V4_SCHEMA.map((schema) => [schema.fileName, schema]),
);

export const isGtfsV4TableName = (value: string): value is GtfsV4TableName =>
  schemaByTableName.has(value as GtfsV4TableName);

export const isGtfsV4FileName = (value: string): value is GtfsV4FileName =>
  schemaByFileName.has(value as GtfsV4FileName);

export const getGtfsV4TableSchema = <TName extends GtfsV4TableName>(
  tableName: TName,
): GtfsV4SchemaEntryByName<TName> => {
  const schema = schemaByTableName.get(tableName);
  if (!schema) {
    throw new Error(`Unknown GTFS v4 table: ${tableName}`);
  }

  return schema as GtfsV4SchemaEntryByName<TName>;
};

export const getGtfsV4TableSchemaByFileName = (
  fileName: GtfsV4FileName,
): GtfsV4SchemaEntry => {
  const schema = schemaByFileName.get(fileName);
  if (!schema) {
    throw new Error(`Unknown GTFS v4 file: ${fileName}`);
  }

  return schema;
};

export const resolveGtfsV4TableNameFromFileName = (
  fileName: string,
): GtfsV4TableName | undefined => {
  const normalized = fileName.toLowerCase() as GtfsV4FileName;
  const schema = schemaByFileName.get(normalized);
  return schema?.tableName;
};

export const resolveGtfsV4FileNameFromTableName = (
  tableName: GtfsV4TableName,
): GtfsV4FileName => {
  return getGtfsV4TableSchema(tableName).fileName;
};
