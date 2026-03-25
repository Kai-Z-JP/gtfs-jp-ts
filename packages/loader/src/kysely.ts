import type { GtfsJpV4TypedRows } from '@gtfs-jp/types';
import {
  DummyDriver,
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely';

import type { DerivedTableName, DerivedTableRow, GtfsSchemaDefinition } from './schema-types.js';

export type GtfsDatabase = GtfsJpV4TypedRows;

type DerivedTableByName<TSchema extends GtfsSchemaDefinition, TName extends string> = Extract<
  NonNullable<TSchema['derivedTables']>[number],
  { name: TName }
>;

export type DerivedTablesKyselyRows<TSchema extends GtfsSchemaDefinition> = {
  [TName in DerivedTableName<TSchema>]: DerivedTableRow<
    DerivedTableByName<TSchema, TName>['columns']
  >;
};

export type KyselyDatabaseFromLoader<TSchema extends GtfsSchemaDefinition> = GtfsDatabase &
  DerivedTablesKyselyRows<TSchema>;

export { DummyDriver, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler };
export type { Kysely };
