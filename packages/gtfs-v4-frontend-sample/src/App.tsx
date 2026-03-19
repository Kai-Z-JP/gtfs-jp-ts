import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, FileArchive, Rows2, Search, X } from "lucide-react";

import { createGtfsV4SqliteLoader, type GtfsV4SqliteLoader, type SqliteStorageMode } from "@hyperload/gtfs-v4-sql-load";
import { isGtfsV4TableName, type GtfsRow } from "@hyperload/gtfs-v4-struct";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { cn } from "./lib/utils";

type StatusType = "ok" | "warn" | "error";

type OpfsSupport = {
  available: boolean;
  reason?: string;
};

export default function App(): JSX.Element {
  const [storage, setStorage] = useState<SqliteStorageMode>("memory");
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({
    type: "warn",
    message: "DB未接続",
  });
  const [summary, setSummary] = useState("テーブル一覧を取得してください");
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [rows, setRows] = useState<GtfsRow[]>([]);
  const [limit, setLimit] = useState("50");
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loaderRef = useRef<GtfsV4SqliteLoader | undefined>(undefined);
  const opfsSupport = useMemo(() => detectOpfsSupport(), []);

  const isOpen = loaderRef.current !== undefined;

  const setStatusMessage = useCallback((message: string, type: StatusType) => {
    setStatus({ message, type });
  }, []);

  useEffect(() => {
    if (storage === "opfs" && !opfsSupport.available) {
      setStorage("memory");
    }
  }, [opfsSupport.available, storage]);

  const closeCurrentLoader = useCallback(async () => {
    if (!loaderRef.current) {
      return;
    }

    await loaderRef.current.close();
    loaderRef.current = undefined;
  }, []);

  useEffect(() => {
    return () => {
      void closeCurrentLoader();
    };
  }, [closeCurrentLoader]);

  const refreshTables = useCallback(async () => {
    if (!loaderRef.current) {
      return;
    }

    const names = await loaderRef.current.listAllTables();
    setTableNames(names);

    if (names.length === 0) {
      setSelectedTable("");
      setSummary("テーブルが見つかりません");
      setRows([]);
      return;
    }

    setSelectedTable((current) => (current && names.includes(current) ? current : names[0]));
    setSummary(`${names.length} tables: ${names.join(", ")}`);
  }, []);

  const handleOpen = useCallback(async () => {
    setBusy(true);
    try {
      if (storage === "opfs" && !opfsSupport.available) {
        setStatusMessage(`OPFSを利用できません: ${opfsSupport.reason ?? "環境未対応"}`, "warn");
        return;
      }

      await closeCurrentLoader();

      loaderRef.current = await createGtfsV4SqliteLoader({
        storage,
        filename: "gtfs-v4-sample.sqlite3",
      });

      setStatusMessage(`接続完了: ${storage} (${new Date().toLocaleTimeString("ja-JP")})`, "ok");
      setSummary("接続済み。GTFS ZIP投入、またはテーブル一覧取得を実行してください。");
      setRows([]);
      setTableNames([]);
      setSelectedTable("");
    } catch (error) {
      handleError(error, "DB接続に失敗しました", setStatusMessage);
    } finally {
      setBusy(false);
    }
  }, [closeCurrentLoader, opfsSupport.available, opfsSupport.reason, setStatusMessage, storage]);

  const handleClose = useCallback(async () => {
    setBusy(true);
    try {
      await closeCurrentLoader();
      setStatusMessage("DBをクローズしました", "ok");
      setTableNames([]);
      setSelectedTable("");
      setRows([]);
      setSummary("DB未接続");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setBusy(false);
    }
  }, [closeCurrentLoader, setStatusMessage]);

  const handleImportZip = useCallback(async () => {
    if (!loaderRef.current) {
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setStatusMessage("GTFS ZIPファイルを選択してください", "warn");
      return;
    }

    setBusy(true);
    try {
      const startedAt = performance.now();
      const result = await importGtfsZip(file, loaderRef.current, setStatusMessage);
      const elapsedSeconds = (performance.now() - startedAt) / 1000;
      const elapsedLabel = `${elapsedSeconds.toFixed(2)}s`;
      await refreshTables();

      const skipped = result.skippedFiles.length > 0 ? ` / skipped: ${result.skippedFiles.join(", ")}` : "";
      setSummary(`ZIP import done: ${result.tablesImported} tables, ${result.rowsImported} rows, ${elapsedLabel}${skipped}`);
      setStatusMessage(`ZIP取込完了: ${result.tablesImported} tables (${elapsedLabel})`, "ok");
    } catch (error) {
      handleError(error, "ZIP取込に失敗しました", setStatusMessage);
    } finally {
      setBusy(false);
    }
  }, [refreshTables, setStatusMessage]);

  const handleClearDatabase = useCallback(async () => {
    if (!loaderRef.current) {
      return;
    }

    const confirmed = globalThis.confirm("現在のDBを削除して再作成します。この操作は元に戻せません。続行しますか？");
    if (!confirmed) {
      setStatusMessage("DBクリアをキャンセルしました", "warn");
      return;
    }

    setBusy(true);
    try {
      await loaderRef.current.clearDatabase();
      await refreshTables();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setStatusMessage("DBを削除して再作成しました", "ok");
    } catch (error) {
      handleError(error, "DBクリアに失敗しました", setStatusMessage);
    } finally {
      setBusy(false);
    }
  }, [refreshTables, setStatusMessage]);

  const handleReadRows = useCallback(async () => {
    if (!loaderRef.current) {
      return;
    }

    if (!selectedTable) {
      setStatusMessage("テーブルを選択してください", "warn");
      return;
    }

    const parsedLimit = Number.parseInt(limit, 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setStatusMessage("limit は1以上の整数にしてください", "warn");
      return;
    }

    setBusy(true);
    try {
      const loadedRows = isGtfsV4TableName(selectedTable)
        ? await loaderRef.current.readTable(selectedTable, { limit: parsedLimit })
        : await loaderRef.current.readUnknownTable(selectedTable, { limit: parsedLimit });

      setRows(loadedRows);
      setStatusMessage(`${selectedTable}: ${loadedRows.length} row(s)`, "ok");
    } catch (error) {
      handleError(error, `${selectedTable} の読込に失敗しました`, setStatusMessage);
    } finally {
      setBusy(false);
    }
  }, [limit, selectedTable, setStatusMessage]);

  const statusClassName = useMemo(() => "text-black", []);

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-6 space-y-3">
          <Badge variant="outline">
            Browser SQLite WASM + shadcn/ui
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">GTFS v4 Table Reader</h1>
          <p className="max-w-3xl text-sm text-neutral-700 md:text-base">
            in-memory / OPFS を切り替えて GTFS ZIP を読み込み、テーブルを確認できます。
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card className="border-black bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Connection
              </CardTitle>
              <CardDescription>DB接続・ZIP投入・デモ投入</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storage">Storage</Label>
                <select
                  id="storage"
                  className="h-10 w-full rounded-md border border-black bg-white px-3 text-sm text-black outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-black"
                  value={storage}
                  onChange={(event) => setStorage(event.target.value as SqliteStorageMode)}
                  disabled={busy || isOpen}
                >
                  <option value="memory">memory (:memory:)</option>
                  <option value="opfs" disabled={!opfsSupport.available}>opfs (file:...vfs=opfs)</option>
                </select>
                {!opfsSupport.available && (
                  <p className="text-xs text-neutral-600">
                    OPFS unavailable: {opfsSupport.reason}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip-file">GTFS ZIP</Label>
                <Input id="zip-file" ref={fileInputRef} type="file" accept=".zip,application/zip" disabled={busy || !isOpen} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button disabled={busy || isOpen} onClick={() => void handleOpen()}>
                  Open DB
                </Button>
                <Button variant="secondary" disabled={busy || !isOpen} onClick={() => void handleImportZip()}>
                  <FileArchive className="h-4 w-4" />
                  Import ZIP
                </Button>
                <Button variant="outline" disabled={busy || !isOpen} onClick={() => void refreshTables()}>
                  List Tables
                </Button>
                <Button variant="outline" disabled={busy || !isOpen} onClick={() => void handleClearDatabase()}>
                  Clear DB
                </Button>
                <Button variant="ghost" className="col-span-2" disabled={busy || !isOpen} onClick={() => void handleClose()}>
                  <X className="h-4 w-4" />
                  Close DB
                </Button>
              </div>

              <p className={cn("rounded-md border border-black bg-white px-3 py-2 text-sm", statusClassName)}>{status.message}</p>
            </CardContent>
          </Card>

          <Card className="border-black bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rows2 className="h-4 w-4" />
                Table Viewer
              </CardTitle>
              <CardDescription>{summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_140px_120px]">
                <div className="space-y-2">
                  <Label htmlFor="table">Table</Label>
                  <select
                    id="table"
                    className="h-10 w-full rounded-md border border-black bg-white px-3 text-sm text-black outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-black"
                    value={selectedTable}
                    onChange={(event) => setSelectedTable(event.target.value)}
                    disabled={busy || !isOpen || tableNames.length === 0}
                  >
                    {tableNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limit">Limit</Label>
                  <Input
                    id="limit"
                    type="number"
                    min={1}
                    max={5000}
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    disabled={busy || !isOpen}
                  />
                </div>

                <div className="flex items-end">
                  <Button className="w-full" disabled={busy || !isOpen || tableNames.length === 0} onClick={() => void handleReadRows()}>
                    <Search className="h-4 w-4" />
                    Read
                  </Button>
                </div>
              </div>

              <div className="max-h-[560px] overflow-auto rounded-lg border border-black bg-white">
                {rows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-neutral-600">0 rows</div>
                ) : (
                  <DataTable rows={rows} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function DataTable({ rows }: { rows: GtfsRow[] }): JSX.Element {
  const columns = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) {
        set.add(key);
      }
      return set;
    }, new Set<string>()),
  );

  return (
    <table className="w-full min-w-max border-collapse text-left text-sm">
      <thead className="sticky top-0 z-10 bg-neutral-100">
        <tr>
          {columns.map((column) => (
            <th key={column} className="border-b border-black px-3 py-2 text-xs uppercase tracking-wide text-neutral-700">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-neutral-300">
            {columns.map((column) => (
              <td key={`${rowIndex}-${column}`} className="max-w-[320px] truncate px-3 py-2 text-black">
                {stringifyValue(row[column])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function importGtfsZip(
  file: File,
  loader: GtfsV4SqliteLoader,
  onStatus: (message: string, type: StatusType) => void,
): Promise<{
  tablesImported: number;
  rowsImported: number;
  skippedFiles: string[];
}> {
  return await loader.importGtfsZip(file, {
    onStatus: (message) => {
      onStatus(message, "ok");
    },
  });
}

function stringifyValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function handleError(
  error: unknown,
  prefix: string,
  setStatusMessage: (message: string, type: StatusType) => void,
): void {
  const message = error instanceof Error ? error.message : String(error);
  setStatusMessage(`${prefix}: ${message}`, "error");
}

function detectOpfsSupport(): OpfsSupport {
  if (!globalThis.isSecureContext) {
    return {
      available: false,
      reason: "HTTPS または localhost でアクセスしてください。",
    };
  }

  if (!globalThis.crossOriginIsolated) {
    return {
      available: false,
      reason: "COOP/COEP が不足しています (Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy)。",
    };
  }

  if (typeof globalThis.SharedArrayBuffer === "undefined" || typeof globalThis.Atomics === "undefined") {
    return {
      available: false,
      reason: "SharedArrayBuffer/Atomics が利用できません。",
    };
  }

  if (typeof globalThis.navigator?.storage?.getDirectory !== "function") {
    return {
      available: false,
      reason: "このブラウザは OPFS API (navigator.storage.getDirectory) に未対応です。",
    };
  }

  return { available: true };
}
