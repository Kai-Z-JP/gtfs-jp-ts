# @hyperload/gtfs-v4-struct

GTFS v4 のスキーマ定義と、スキーマから導出される TypeScript 型を提供します。

## Example

```ts
import {
  GTFS_V4_SCHEMA,
  GTFS_V4_TABLE_NAMES,
  getGtfsV4TableSchema,
  type GtfsV4TableName,
  type GtfsV4TableRow,
} from "@hyperload/gtfs-v4-struct";

const tables: readonly GtfsV4TableName[] = GTFS_V4_TABLE_NAMES;
const routesSchema = getGtfsV4TableSchema("routes");

const row: GtfsV4TableRow<"routes"> = {
  route_id: "R1",
  agency_id: "A1",
  route_type: 3,
};

console.log(GTFS_V4_SCHEMA.length, routesSchema.columns, row);
```
