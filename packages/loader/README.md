# @gtfs-jp/loader

ブラウザ上で GTFS-JP v4 ZIP を SQLite WASM に取り込み、型安全にクエリできるローダーです。ストレージは in-memory と OPFS (
永続化) を選択できます。

## Install

```bash
npm install @gtfs-jp/loader @gtfs-jp/types
```

`@sqlite.org/sqlite-wasm` が peer dependency として必要です。

## Basic Usage

```ts
import { createGtfsLoader } from "@gtfs-jp/loader";

const loader = createGtfsLoader({ storage: "memory" });
await loader.open();

// ZIP インポート (進捗コールバック付き)
const result = await loader.importZip(file, {
  onProgress: (event) => console.log(event.phase, event.message),
});

console.log(`${result.tablesImported} tables, ${result.rowsImported} rows`);

// 型付き読み取り
const routes = await loader.readTable("routes", {
  limit: 100,
  orderBy: "route_id",
});

await loader.close();
```

## Storage Modes

```ts
// in-memory (揮発性、高速)
createGtfsLoader({storage: "memory"});

// OPFS (永続化、ブラウザ再起動後も保持)
createGtfsLoader({storage: "opfs", filename: "gtfs.sqlite3"});
```

OPFS を使用するには、ページに以下のヘッダーが必要です:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Import Options

```ts
await loader.importZip(file, {
  parseWorkerConcurrency: 8,    // CSV パース並列数
  dbWriteConcurrency: 4,        // DB 書き込み並列数
  parseChunkRowCount: 1000,     // パースチャンクサイズ
  insertBatchRowCount: 500,     // INSERT バッチサイズ
  opfsImportMode: "memory-stage", // OPFS時: メモリで構築してから反映 (default)
  onProgress: (event) => {
    // event.phase: "prepare" | "import" | "derive" | "done" | "error"
    // event.targetName, event.state, event.rowsWritten ...
  },
});
```

## Derived Tables

ソーステーブルから派生テーブルを定義し、インポート時に自動 materialize できます。

```ts
import { createGtfsLoader, defineGtfsSchema, derivedTable } from "@gtfs-jp/loader";

const routeSummary = derivedTable({
  name: "route_summary",
  dependsOn: ["routes", "trips"],
  columns: {
    route_id: { kind: "string", nullable: false },
    trip_count: { kind: "number", nullable: false },
  },
  build: {
    kind: "sql",
    selectSql: `
      SELECT r.route_id, COUNT(t.trip_id) AS trip_count
      FROM routes r LEFT JOIN trips t ON r.route_id = t.route_id
      GROUP BY r.route_id
    `,
  },
});

const schema = defineGtfsSchema({
  derivedTables: [routeSummary],
});

const loader = createGtfsLoader({ schema });
```

### Build Strategies

**SQL** — 単一 SELECT 文:

```ts
build: {
  kind: "sql",
  selectSql: "SELECT route_id, COUNT(*) as cnt FROM trips GROUP BY route_id",
}
```

**SQL Script** — 複数 SQL 文 (DDL/DML):

```ts
build: {
  kind: "sqlScript",
  statements: [
    "INSERT INTO my_table SELECT * FROM source WHERE condition",
  ],
}
```

**JS** — TypeScript で変換ロジックを記述:

```ts
build: {
  kind: "js",
  async *run(context) {
    const stops = await context.readSource("stops", {
      columns: ["stop_id", "stop_name", "stop_lat", "stop_lon"],
    });
    for (const stop of stops) {
      yield { stop_id: stop.stop_id, label: `${stop.stop_name} (${stop.stop_lat})` };
    }
  },
}
```

JS builder の `context` には以下のメソッドがあります:

| メソッド                               | 説明                  |
|------------------------------------|---------------------|
| `readSource(table, opts?)`         | ソーステーブルを型付きで読み取り    |
| `readOptionalSource(table, opts?)` | テーブルが存在しない場合は空配列を返す |
| `hasSource(table)`                 | ソーステーブルの存在確認        |
| `query(sql, bind?)`                | 任意の SQL を実行して結果を取得  |
| `exec(sql, bind?)`                 | 任意の SQL を実行 (結果なし)  |
| `emitProgress(progress)`           | 進捗を通知               |

## API

### `createGtfsLoader(options?)`

ローダーインスタンスを生成します。

| オプション                 | 型                      | デフォルト      | 説明                        |
|-----------------------|------------------------|------------|---------------------------|
| `storage`             | `"memory" \| "opfs"`   | `"memory"` | ストレージモード                  |
| `filename`            | `string`               | —          | OPFS ファイル名                |
| `worker`              | `Worker`               | —          | カスタム Worker インスタンス        |
| `strictGtfsTableName` | `boolean`              | `true`     | 未知のテーブル名でエラーにするか          |
| `schema`              | `GtfsSchemaDefinition` | —          | 派生テーブル定義を含むスキーマ           |
| `runtime`             | `object`               | —          | JS builder に渡すランタイムコンテキスト |

### `GtfsLoader` メソッド

| メソッド                         | 説明                                         |
|------------------------------|--------------------------------------------|
| `open()`                     | DB を開く                                     |
| `close(options?)`            | DB を閉じる (`{ unlink: true }` で OPFS ファイル削除) |
| `reset()`                    | DB を削除して再作成                                |
| `importZip(file, options?)`  | GTFS-JP ZIP をインポート                         |
| `readTable(name, options?)`  | GTFS ソーステーブルを型付きで読み取り                      |
| `readSource(name, options?)` | ソーステーブルをスキーマに基づく型変換付きで読み取り                 |
| `read(name, options?)`       | ソース/派生テーブルをスキーマ型で読み取り                      |
| `readRows(name, options?)`   | 任意のテーブルを `GtfsRow[]` で読み取り                 |
| `loadTables(options?)`       | 複数テーブルを一括読み取り                              |
| `listTables()`               | 全テーブル名を取得                                  |
| `listGtfsTables()`           | GTFS テーブル名のみ取得                             |
| `hasTable(name)`             | テーブルの存在確認                                  |
| `query(sql, bind?)`          | 任意の SQL を実行して結果を取得                         |
| `exec(sql, bind?)`           | 任意の SQL を実行                                |

### `TableReadOptions`

| オプション     | 型                    | 説明         |
|-----------|----------------------|------------|
| `limit`   | `number`             | 取得行数の上限    |
| `offset`  | `number`             | スキップする行数   |
| `orderBy` | `string \| string[]` | ソート対象のカラム  |
| `columns` | `string[]`           | 取得するカラムを指定 |

## License

[MIT](../../LICENSE)
