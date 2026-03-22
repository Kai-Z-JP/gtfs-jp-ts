# @gtfs-jp

GTFS-JP v4 を TypeScript で扱うためのライブラリ群です。ブラウザ上で GTFS-JP ZIP を SQLite WASM に取り込み、型安全にデータを読み書きできます。

## Packages

| パッケージ                                  | 概要                                                     |
|----------------------------------------|--------------------------------------------------------|
| [`@gtfs-jp/types`](./packages/types)   | GTFS-JP v4 全33テーブルのスキーマ定義と TypeScript 型                |
| [`@gtfs-jp/loader`](./packages/loader) | Browser SQLite WASM (in-memory / OPFS) によるZIPインポートとクエリ |

## Quick Start

```bash
npm install @gtfs-jp/types @gtfs-jp/loader
```

```ts
import {createGtfsLoader} from "@gtfs-jp/loader";

const loader = createGtfsLoader({storage: "memory"});
await loader.open();

// GTFS-JP ZIP をインポート
await loader.importZip(file);

// 型付きでテーブルを読み取り
const routes = await loader.readTable("routes", {limit: 100});
// routes[0].route_id, routes[0].route_type ... 全て型付き

await loader.close();
```

## Apps

| ディレクトリ                     | 概要                                 |
|----------------------------|------------------------------------|
| [`apps/demo`](./apps/demo) | `@gtfs-jp/loader` を使ったブラウザ UI サンプル |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

[MIT](./LICENSE)
