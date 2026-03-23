# @gtfs-jp/types

GTFS-JP v4 全33テーブルのスキーマ定義と、スキーマから導出される TypeScript 型を提供します。

## Install

```bash
npm install @gtfs-jp/types
```

## Usage

### テーブル名の一覧と判定

```ts
import { GTFS_JP_V4_TABLE_NAMES, isGtfsJpV4TableName } from '@gtfs-jp/types';

console.log(GTFS_JP_V4_TABLE_NAMES);
// ["feed_info", "agency", "stops", "routes", "trips", ...]

isGtfsJpV4TableName('routes'); // true
isGtfsJpV4TableName('unknown'); // false
```

### スキーマの取得

```ts
import { getGtfsJpV4TableSchema } from '@gtfs-jp/types';

const schema = getGtfsJpV4TableSchema('routes');
// schema.fileName  → "routes.txt"
// schema.requirement → "required"
// schema.columns   → { route_id: { kind: "string", required: true }, ... }
```

### 型付き行データ

```ts
import type { GtfsJpV4TableRow } from '@gtfs-jp/types';

// routes テーブルの行型が自動導出される
type RouteRow = GtfsJpV4TableRow<'routes'>;
// { route_id: string; agency_id: string | undefined; route_type: number; ... }

const row: RouteRow = {
  route_id: 'R1',
  agency_id: 'A1',
  route_type: 3,
};
```

### ファイル名とテーブル名の相互変換

```ts
import {
  resolveGtfsJpV4TableNameFromFileName,
  resolveGtfsJpV4FileNameFromTableName,
  isGtfsJpV4FileName,
} from '@gtfs-jp/types';

resolveGtfsJpV4TableNameFromFileName('routes.txt'); // "routes"
resolveGtfsJpV4FileNameFromTableName('routes'); // "routes.txt"
isGtfsJpV4FileName('routes.txt'); // true
```

## API

### 定数

| 名前                     | 説明                           |
| ------------------------ | ------------------------------ |
| `GTFS_JP_V4_SCHEMA`      | 全33テーブルのスキーマ定義配列 |
| `GTFS_JP_V4_TABLE_NAMES` | テーブル名の `readonly` 配列   |
| `GTFS_JP_V4_FILE_NAMES`  | ファイル名の `readonly` 配列   |

### 関数

| 名前                                              | 説明                              |
| ------------------------------------------------- | --------------------------------- |
| `getGtfsJpV4TableSchema(tableName)`               | テーブル名からスキーマを取得      |
| `getGtfsJpV4TableSchemaByFileName(fileName)`      | ファイル名からスキーマを取得      |
| `isGtfsJpV4TableName(value)`                      | GTFS-JP v4 テーブル名かどうか判定 |
| `isGtfsJpV4FileName(value)`                       | GTFS-JP v4 ファイル名かどうか判定 |
| `resolveGtfsJpV4TableNameFromFileName(fileName)`  | ファイル名 → テーブル名           |
| `resolveGtfsJpV4FileNameFromTableName(tableName)` | テーブル名 → ファイル名           |

### 型

| 名前                      | 説明                           |
| ------------------------- | ------------------------------ |
| `GtfsJpV4TableName`       | 全テーブル名のユニオン型       |
| `GtfsJpV4FileName`        | 全ファイル名のユニオン型       |
| `GtfsJpV4TableRow<TName>` | テーブル名から導出される行の型 |
| `GtfsJpV4TableSchema`     | テーブルスキーマの型           |
| `GtfsJpV4ColumnSchema`    | カラムスキーマの型             |

### スカラー型

CSV の値に意味的な型を付与するブランド型です。実体はすべて `string` または `number` です。

`GtfsId` `GtfsText` `GtfsDate` `GtfsTime` `GtfsUrl` `GtfsEmail` `GtfsColor` `GtfsPhoneNumber` `GtfsTimezone`
`GtfsLanguageCode` `GtfsCurrencyCode` `BinaryFlag`

## License

[MIT](../../LICENSE)
