# @gtfs-jp/query

`@gtfs-jp/loader` の上に載る、GTFS-JP データ向けの再利用可能な read/query helper 集です。

## インストール

```sh
pnpm add @gtfs-jp/query kysely
```

`kysely` は peer dependency です。

## 前提

このパッケージは `GtfsQuerySource` を受け取ります。  
`@gtfs-jp/loader` から DB を構築したら、以下の形で渡してください。

```ts
import type { GtfsQuerySource } from '@gtfs-jp/query';

const source: GtfsQuerySource = {
  db,
  hasTable: (name) => checkTableExists(name),
};
```

## API

### `getActiveServiceIds`

指定日に運行している `service_id` の一覧を返します。  
`calendar` テーブルの曜日フラグ・期間チェックに加え、`calendar_dates` の例外（追加/除外）を適用します。

```ts
import { getActiveServiceIds } from '@gtfs-jp/query';

const { serviceIds, warnings } = await getActiveServiceIds(source, '2025-04-14');
// serviceIds: Set<string>
// warnings:   問題があった場合のメッセージ一覧
```

| 引数          | 型                | 説明                    |
| ------------- | ----------------- | ----------------------- |
| `source`      | `GtfsQuerySource` | クエリ発行先            |
| `serviceDate` | `string`          | `YYYY-MM-DD` 形式の日付 |

- `calendar` テーブルが存在しない場合は空の Set を返し、`warnings` に理由を記載します。
- `calendar_dates` が存在する場合は `exception_type` 1（追加）/ 2（除外）を反映します。

---

### `getStopTimetableDetail`

指定した停留所・日付の時刻表詳細を返します。

```ts
import { getStopTimetableDetail } from '@gtfs-jp/query';

const detail = await getStopTimetableDetail(source, {
  stopId: 'STOP_PARENT',
  serviceDate: '2025-04-14',
  routeId: 'R1', // 省略可: 絞り込む route_id
});
```

**オプション (`LoadStopTimetableOptions`)**

| フィールド    | 型       | 必須 | 説明                    |
| ------------- | -------- | ---- | ----------------------- |
| `stopId`      | `string` | ✔    | 取得対象の `stop_id`    |
| `serviceDate` | `string` | ✔    | `YYYY-MM-DD` 形式の日付 |
| `routeId`     | `string` | —    | 特定の路線に絞り込む    |

**戻り値 (`StopTimetableDetail`)**

```ts
type StopTimetableDetail = {
  selectedStop: StopInfo; // 指定した停留所
  childStops: StopInfo[]; // 子バス停（親停留所の場合のみ）
  timetableGroups: StopTimetableGroup[]; // バス停ごとの時刻表
  warnings: string[]; // 軽微な問題のメッセージ
};

type StopTimetableGroup = {
  stop: StopInfo;
  rows: StopTimetableRow[]; // 発車時刻順にソート済み
};
```

**親停留所の自動展開**

`location_type === 1` の親停留所を指定すると、`parent_station` が一致する子バス停（`location_type === 0 | null`）を自動的に取得し、各バス停の時刻表を個別に返します。  
直接バス停を指定した場合は `childStops` は空配列になります。

**エラーと警告**

- `routes`, `trips`, `stop_times`, `stops` のいずれかが欠けている場合は `Error` をスローします。
- `stop_id` が見つからない場合も `Error` をスローします。
- 指定日に運行する便がない場合は `warnings` にメッセージを返します（例外はスローしません）。

## 型一覧

```ts
// クエリのデータソース
type GtfsQuerySource<TDB extends GtfsDatabase = KyselyDatabaseFromLoader<GtfsSchemaDefinition>> = {
  db: Kysely<TDB>;
  hasTable: (tableName: string) => Promise<boolean>;
};

// getActiveServiceIds の戻り値
type GetActiveServiceIdsResult = {
  serviceIds: Set<string>;
  warnings: string[];
};

// 停留所情報
type StopInfo = {
  stopId: string;
  stopCode: string | null;
  stopName: string;
  stopDesc: string | null;
  stopLat: number | null;
  stopLon: number | null;
  stopUrl: string | null;
  locationType: number | null;
  parentStation: string | null;
  stopTimezone: string | null;
  wheelchairBoarding: number | null;
  platformCode: string | null;
};

// 時刻表の1行
type StopTimetableRow = {
  arrivalTime: string | null;
  departureTime: string | null;
  routeId: string;
  routeLabel: string; // route_short_name / route_long_name から生成
  tripId: string;
  tripHeadsign: string | null;
  directionId: number | null;
  stopSequence: number;
  stopId: string;
  stopName: string;
  platformCode: string | null;
};
```
