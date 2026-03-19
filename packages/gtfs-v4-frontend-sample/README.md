# @hyperload/gtfs-v4-frontend-sample

`@hyperload/gtfs-v4-sql-load` を使った、shadcn/ui + React のフロントエンドサンプルです。

## Run

```bash
npm install
npm run build
npm run dev -w @hyperload/gtfs-v4-frontend-sample
```

## What it does

- SQLite WASM の `memory` / `opfs` 切り替え
- GTFS ZIP の投入（`.txt` を自動でテーブル化）
- Demo GTFS データ投入
- DB内テーブル一覧取得
- テーブル行表示

## OPFS を使う条件

- `http://localhost` または `https://` でアクセスする（Secure Context）
- サーバーが次のヘッダーを返す
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`

Vite 設定では上記ヘッダーを `server` と `preview` に設定済みです。  
別のリバースプロキシやホスティング経由の場合は、そのレイヤーでも同じヘッダーが必要です。
