# @hyperload/gtfs-jp-v4-struct

GTFS-JP v4 のスキーマ定義と、スキーマから導出される TypeScript 型を提供します。

## Example

```ts
import {
  GTFS_JP_V4_SCHEMA,
  GTFS_JP_V4_TABLE_NAMES,
  getGtfsJpV4TableSchema,
  type GtfsJpV4TableName,
  type GtfsJpV4TableRow,
} from "@hyperload/gtfs-jp-v4-struct";

const tables: readonly GtfsJpV4TableName[] = GTFS_JP_V4_TABLE_NAMES;
const routesSchema = getGtfsJpV4TableSchema("routes");

const row: GtfsJpV4TableRow<"routes"> = {
  route_id: "R1",
  agency_id: "A1",
  route_type: 3,
};

console.log(GTFS_JP_V4_SCHEMA.length, routesSchema.columns, row);
```
