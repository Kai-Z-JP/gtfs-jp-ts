# Sample Quick Start（初回 clone 向け）

このドキュメントは、初めてこのリポジトリを `clone` した人が  
`@gtfs-jp/frontend-sample` を起動するための手順です。

## 前提

- `git` が使える
- `Node.js`（推奨: 20 以上）
- `corepack` が使える（Node.js 同梱）

## 手順

1. リポジトリを clone

```bash
git clone <REPOSITORY_URL>
cd <repo-directory>
```

2. `pnpm` を有効化（初回のみ）

```bash
corepack enable
corepack prepare pnpm@8.15.9 --activate
```

3. 依存関係をインストール

```bash
pnpm install
```

4. ワークスペースのパッケージをビルド

```bash
pnpm build
```

5. Sample を起動

```bash
pnpm --filter @gtfs-jp/frontend-sample dev
```

6. ブラウザでアクセス

```text
http://localhost:5173
```

## よくある詰まりどころ

- `pnpm: command not found`
  - `corepack enable` と `corepack prepare pnpm@8.15.9 --activate` を実行してください。
- `Cannot find module .../dist/...`
  - `pnpm build` を先に実行してください（workspace 依存が `dist` を参照します）。
- OPFS が使えない
  - `http://localhost` または `https://` で開いているか確認してください。
  - 開発サーバー以外を使う場合は `COOP/COEP` ヘッダー設定が必要です。
