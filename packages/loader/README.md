# @gtfs-jp/loader

`@sqlite.org/sqlite-wasm` を使って、ブラウザ上で GTFS-JP v4 ZIP を SQLite に取り込み、必要に応じて派生テーブルを
materialize します。

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
    console.log(event.phase, event.targetKind, event.targetName, event.state, event.message);
  },
});

console.log(
  result.tablesImported,
  result.rowsImported,
  result.derivedTablesMaterialized,
  result.derivedRowsWritten,
  result.skippedFiles,
);

const rows = await loader.readRows("routes", { limit: 100, orderBy: "route_id" });
console.log(rows);

await loader.close();
```

## JS Builder Source Reader

JS builder では `context.query()` を escape hatch として残しつつ、通常は typed source reader を使います。

```ts
const calendarDates = await context.readOptionalSource("calendar_dates", {
  columns: ["service_id", "date", "exception_type"],
});
```

- SQL builder は `INSERT ... SELECT ...` のような set-based 処理向けです。
- JS builder は原表を `readSource()` / `readOptionalSource()` で読み、変換ロジックを TypeScript で書く用途向けです。
- `hasSource()` は source table の有無だけを知りたいときに使います。

## Notes

- `storage: "memory"` は `:memory:` DB を使用します。
- `storage: "opfs"` は `file:...?...vfs=opfs` を使用します。
- `importZip` は parse worker から chunk 単位で受け取り、書き込みパイプラインで処理します。
- `opfsImportMode: "memory-stage"` は既定値です（`:memory:` で構築して OPFS ファイルへ反映）。
- `reset` は DB を削除して再作成します（OPFS は `unlink` を使います）。
