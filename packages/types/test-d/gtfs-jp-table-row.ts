import type { GtfsJpV4TableRow } from '../src/types.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type IsOptional<T, K extends keyof T> = Pick<T, K> extends Required<Pick<T, K>> ? false : true;

type RoutesRow = GtfsJpV4TableRow<'routes'>;
type OfficeRow = GtfsJpV4TableRow<'office_jp'>;

export type GtfsJpTableRowAssertions = [
  Expect<Equal<RoutesRow['route_id'], string>>,
  Expect<Equal<RoutesRow['route_short_name'], string | null>>,
  Expect<Equal<RoutesRow['route_sort_order'], number | null>>,
  Expect<Equal<IsOptional<RoutesRow, 'route_short_name'>, false>>,
  Expect<Equal<OfficeRow['office_url'], string | null>>,
  Expect<Equal<IsOptional<OfficeRow, 'office_url'>, false>>,
];

export {};
