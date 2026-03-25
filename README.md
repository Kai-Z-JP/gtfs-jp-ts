# @gtfs-jp

GTFS-JP v4 を TypeScript で扱うためのライブラリ群です。ブラウザ上で GTFS-JP ZIP を SQLite WASM に取り込み、型安全にデータを読み書きできます。

## Packages

| パッケージ                             | 概要                                                               |
| -------------------------------------- | ------------------------------------------------------------------ |
| [`@gtfs-jp/types`](./packages/types)   | GTFS-JP v4 全33テーブルのスキーマ定義と TypeScript 型              |
| [`@gtfs-jp/loader`](./packages/loader) | Browser SQLite WASM (in-memory / OPFS) によるZIPインポートとクエリ |

## Quick Start

```bash
npm install @gtfs-jp/types @gtfs-jp/loader
```

### Vite の設定

Vite を使う場合は、SQLite WASM ファイルが正しく配置されるよう `gtfsLoaderPlugin` を追加してください。

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { gtfsLoaderPlugin } from '@gtfs-jp/loader/vite';

export default defineConfig({
  plugins: [gtfsLoaderPlugin()],
});
```

### 基本的な使い方

```ts
import { createGtfsLoader } from '@gtfs-jp/loader';

const loader = createGtfsLoader({ storage: 'memory' });
await loader.open();

// GTFS-JP ZIP をインポート
await loader.importZip(file);

// Kysely で型付きクエリ
const routes = await loader.db().selectFrom('routes').selectAll().limit(100).execute();
// routes[0].route_id, routes[0].route_type ... 全て型付き

await loader.close();
```

## API 概要

`GtfsLoader` が提供する主なメソッド:

| メソッド                    | 説明                                                               |
| --------------------------- | ------------------------------------------------------------------ |
| `open()`                    | SQLite セッションを開く                                            |
| `close(options?)`           | セッションを閉じる。`{ unlink: true }` で OPFS ファイルを削除      |
| `reset()`                   | データベースをリセット（close + open）                             |
| `importZip(file, options?)` | GTFS-JP ZIP をインポート。`options.onProgress` で進捗を取得可能    |
| `validate()`                | 必須テーブルの存在を検証し `GtfsValidationResult` を返す           |
| `listTables()`              | インポート済みテーブル名の一覧を返す                               |
| `listGtfsTables()`          | GTFS-JP テーブル名のみに絞った一覧を返す                           |
| `hasTable(name)`            | 指定テーブルが存在するか確認する                                   |
| `db()`                      | [Kysely](https://kysely.dev/) インスタンスを返す（型安全クエリ用） |

### サブパスエクスポート

| エクスポート             | 内容                                                                |
| ------------------------ | ------------------------------------------------------------------- |
| `@gtfs-jp/loader`        | `createGtfsLoader`、`defineGtfsSchema`、`derivedTable` など主要 API |
| `@gtfs-jp/loader/vite`   | Vite プラグイン（`gtfsLoaderPlugin`）                               |
| `@gtfs-jp/loader/kysely` | Kysely 型定義（`GtfsDatabase`、`KyselyDatabaseFromLoader` など）    |

## Apps

| ディレクトリ               | 概要                                           |
| -------------------------- | ---------------------------------------------- |
| [`apps/demo`](./apps/demo) | `@gtfs-jp/loader` を使ったブラウザ UI サンプル |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

[MIT](./LICENSE)
