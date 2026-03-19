# HyperLoad

GTFS-JP v4 向けに、以下を分離した TypeScript ライブラリ構成です。

- `@hyperload/gtfs-jp-v4-struct`: GTFS-JP v4 のテーブル/型定義
- `@hyperload/gtfs-jp-v4-sql-load`: Browser SQLite WASM (in-memory / OPFS) のテーブル読込
- `@hyperload/gtfs-jp-v4-frontend-sample`: 上記を使ったブラウザUIサンプル

## Setup

```bash
pnpm install
pnpm build
```

初回 clone 直後に sample を最短で起動したい場合は  
[`SAMPLE_QUICKSTART.md`](./SAMPLE_QUICKSTART.md) を参照してください。

## Packages

- `packages/gtfs-jp-v4-struct`
- `packages/gtfs-jp-v4-sql-load`
- `packages/gtfs-jp-v4-frontend-sample`
