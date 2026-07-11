import { createGtfsLoader } from '@gtfs-jp/loader';
import { expectTypeOf, it } from 'vitest';

import type { GtfsQuerySource } from '../types.js';

type DefaultLoaderDb = ReturnType<ReturnType<typeof createGtfsLoader>['db']>;

it('accepts the default loader database as a query source', () => {
  expectTypeOf<DefaultLoaderDb>().toEqualTypeOf<GtfsQuerySource['db']>();
});
