# @gtfs-jp/loader

`@sqlite.org/sqlite-wasm` を使って、ブラウザ上で GTFS-JP v4 ZIP を SQLite に取り込みます。

## Example

```ts
import { createGtfsLoader } from "@gtfs-jp/loader";

const loader = createGtfsLoader({
  storage: "opfs",
  filename: "gtfs-jp-v4.sqlite3",
});

await loader.open();

const result = await loader.importZip(file, {
  parseWorkerConcurrency: 8,
  dbWriteConcurrency: 4,
  parseChunkRowCount: 1000,
  insertBatchRowCount: 500,
  opfsImportMode: "memory-stage",
  onProgress: (event) => {
    console.log(event.phase, event.tableName, event.tableState, event.message);
  },
});

console.log(result.tablesImported, result.rowsImported, result.skippedFiles);

const rows = await loader.readRows("routes", { limit: 100, orderBy: "route_id" });
console.log(rows);

await loader.close();
```

## Notes

- `storage: "memory"` は `:memory:` DB を使用します。
- `storage: "opfs"` は `file:...?...vfs=opfs` を使用します。
- `importZip` は parse worker から chunk 単位で受け取り、書き込みパイプラインで処理します。
- `opfsImportMode: "memory-stage"` は既定値です（`:memory:` で構築して OPFS ファイルへ反映）。
- `reset` は DB を削除して再作成します（OPFS は `unlink` を使います）。
