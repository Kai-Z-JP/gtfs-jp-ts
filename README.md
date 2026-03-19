# GTFS-JP Workspace

GTFS-JP v4 向けに、以下を分離した TypeScript ライブラリ構成です。

- `@gtfs-jp/types`: GTFS-JP v4 のテーブル/型定義
- `@gtfs-jp/loader`: Browser SQLite WASM (in-memory / OPFS) のテーブル読込
- `@gtfs-jp/frontend-sample`: 上記を使ったブラウザUIサンプル

## Setup

```bash
pnpm install
pnpm build
```

初回 clone 直後に sample を最短で起動したい場合は  
[`SAMPLE_QUICKSTART.md`](./SAMPLE_QUICKSTART.md) を参照してください。

## Packages

- `packages/types`
- `packages/loader`
- `packages/frontend-sample`
