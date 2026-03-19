# @hyperload/gtfs-v4-sql-load

`@sqlite.org/sqlite-wasm` を使って、ブラウザ上で GTFS v4 テーブルを読み込みます。

## Example

```ts
import { createGtfsV4SqliteLoader } from "@hyperload/gtfs-v4-sql-load";

const loader = await createGtfsV4SqliteLoader({ storage: "opfs" });

const routes = await loader.readTable("routes", {
  limit: 100,
  orderBy: "route_id",
});

console.log(routes);

const importResult = await loader.importGtfsZip(file, {
  parseWorkerConcurrency: 8,
  dbWriteConcurrency: 4,
  opfsImportMode: "memory-stage",
  onProgress: (event) => {
    if (event.tableState && event.fileName) {
      console.log(event.fileName, event.tableState);
      return;
    }
    console.log(event.phase);
  },
});
console.log(importResult);

await loader.clearDatabase();

await loader.close();
```

## Notes

- `storage: "memory"` は `:memory:` DB を使います。
- `storage: "opfs"` は `file:...?...vfs=opfs` を使います。
- `clearDatabase` は DB 自体を削除して再作成します（`memory` は再初期化、`opfs` は `unlink` でファイル削除後に再作成）。
- `readTable` / `readUnknownTable` は `limit` 未指定時、件数制限なしで読み込みます。
- `importGtfsZip` は ZIP 解析・テーブル作成・データ投入を行います。
- `importGtfsZip` は Parse と DB write をファイル単位でパイプライン実行します。
- `parseWorkerConcurrency` は CSV 解析 Worker 数、`dbWriteConcurrency` は DB write 並列度です。
- `storage: "opfs"` の `importGtfsZip` は既定で `opfsImportMode: "memory-stage"` を使い、`:memory:` DB に投入後、SQLiteファイル全体を OPFS に反映します（既存DBは全体置換）。
- `opfsImportMode: "direct"` を指定すると、OPFSへ直接INSERTする従来経路を使えます。
- OPFS 利用時は `COOP/COEP` などの配信ヘッダ要件に注意してください。
