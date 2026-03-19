# HyperLoad

GTFS v4 向けに、以下を分離した TypeScript ライブラリ構成です。

- `@hyperload/gtfs-v4-struct`: GTFS v4 のテーブル/型定義
- `@hyperload/gtfs-v4-sql-load`: Browser SQLite WASM (in-memory / OPFS) のテーブル読込
- `@hyperload/gtfs-v4-frontend-sample`: 上記を使ったブラウザUIサンプル

## Setup

```bash
pnpm install
pnpm build
```

## Packages

- `packages/gtfs-v4-struct`
- `packages/gtfs-v4-sql-load`
- `packages/gtfs-v4-frontend-sample`
