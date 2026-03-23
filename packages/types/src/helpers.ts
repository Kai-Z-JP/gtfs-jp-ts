import { GTFS_JP_V4_SCHEMA } from './schema.js';
import type {
  GtfsJpV4FileName,
  GtfsJpV4SchemaEntry,
  GtfsJpV4SchemaEntryByName,
  GtfsJpV4TableName,
} from './types.js';

export const GTFS_JP_V4_TABLE_NAMES = GTFS_JP_V4_SCHEMA.map(
  (schema) => schema.tableName,
) as readonly GtfsJpV4TableName[];

export const GTFS_JP_V4_FILE_NAMES = GTFS_JP_V4_SCHEMA.map(
  (schema) => schema.fileName,
) as readonly GtfsJpV4FileName[];

const schemaByTableName = new Map<GtfsJpV4TableName, GtfsJpV4SchemaEntry>(
  GTFS_JP_V4_SCHEMA.map((schema) => [schema.tableName, schema]),
);

const schemaByFileName = new Map<GtfsJpV4FileName, GtfsJpV4SchemaEntry>(
  GTFS_JP_V4_SCHEMA.map((schema) => [schema.fileName, schema]),
);

export const isGtfsJpV4TableName = (value: string): value is GtfsJpV4TableName =>
  schemaByTableName.has(value as GtfsJpV4TableName);

export const isGtfsJpV4FileName = (value: string): value is GtfsJpV4FileName =>
  schemaByFileName.has(value as GtfsJpV4FileName);

export const getGtfsJpV4TableSchema = <TName extends GtfsJpV4TableName>(
  tableName: TName,
): GtfsJpV4SchemaEntryByName<TName> => {
  const schema = schemaByTableName.get(tableName);
  if (!schema) {
    throw new Error(`Unknown GTFS-JP v4 table: ${tableName}`);
  }

  return schema as GtfsJpV4SchemaEntryByName<TName>;
};

export const getGtfsJpV4TableSchemaByFileName = (
  fileName: GtfsJpV4FileName,
): GtfsJpV4SchemaEntry => {
  const schema = schemaByFileName.get(fileName);
  if (!schema) {
    throw new Error(`Unknown GTFS-JP v4 file: ${fileName}`);
  }

  return schema;
};

export const resolveGtfsJpV4TableNameFromFileName = (
  fileName: string,
): GtfsJpV4TableName | undefined => {
  const normalized = fileName.toLowerCase() as GtfsJpV4FileName;
  const schema = schemaByFileName.get(normalized);
  return schema?.tableName;
};

export const resolveGtfsJpV4FileNameFromTableName = (
  tableName: GtfsJpV4TableName,
): GtfsJpV4FileName => {
  return getGtfsJpV4TableSchema(tableName).fileName;
};
