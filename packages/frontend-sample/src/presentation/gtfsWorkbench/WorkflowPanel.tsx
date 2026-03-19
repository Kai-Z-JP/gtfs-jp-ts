import { useEffect, useMemo, useRef } from "react";
import { Database, FileArchive, X } from "lucide-react";

import type { ImportProgressState, OpfsSupport } from "../../domain/gtfsWorkbench";
import type { SqliteStorageMode } from "@gtfs-jp/loader";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import { TableProgressCardView } from "./TableProgressCardView";

type WorkflowPanelProps = {
  storage: SqliteStorageMode;
  derivedTablesEnabled: boolean;
  opfsSupport: OpfsSupport;
  statusMessage: string;
  busy: boolean;
  isOpen: boolean;
  fileInputResetToken: number;
  importProgress: ImportProgressState;
  onStorageChange: (storage: SqliteStorageMode) => void;
  onDerivedTablesEnabledChange: (enabled: boolean) => void;
  onOpen: () => Promise<void>;
  onImportZip: (file: File | undefined) => Promise<void>;
  onRefreshTables: () => Promise<void>;
  onClearDb: () => Promise<void>;
  onClose: () => Promise<void>;
};

export function WorkflowPanel({
  storage,
  derivedTablesEnabled,
  opfsSupport,
  statusMessage,
  busy,
  isOpen,
  fileInputResetToken,
  importProgress,
  onStorageChange,
  onDerivedTablesEnabledChange,
  onOpen,
  onImportZip,
  onRefreshTables,
  onClearDb,
  onClose,
}: WorkflowPanelProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [fileInputResetToken]);

  const totalCards = importProgress.tableCards.length;
  const completedCards = useMemo(
    () =>
      importProgress.tableCards.filter((card) => card.state === "done" || card.state === "skipped")
        .length,
    [importProgress.tableCards],
  );

  const overallProgressPercent = useMemo(() => {
    if (totalCards <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((completedCards / totalCards) * 100)));
  }, [completedCards, totalCards]);

  return (
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
              onChange={(event) => onStorageChange(event.target.value as SqliteStorageMode)}
              disabled={busy || isOpen}
            >
              <option value="memory">memory (:memory:)</option>
              <option value="opfs" disabled={!opfsSupport.available}>
                opfs (file:...vfs=opfs)
              </option>
            </select>
            {!opfsSupport.available && <p className="text-xs text-neutral-600">OPFS unavailable: {opfsSupport.reason}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="zip-file">GTFS ZIP</Label>
            <Input
              id="zip-file"
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              disabled={busy || !isOpen}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="derived-tables">Derived tables</Label>
            <label
              htmlFor="derived-tables"
              className="flex h-10 items-center justify-between rounded-md border border-black bg-white px-3 text-sm text-black"
            >
              <span>universal_calendar</span>
              <input
                id="derived-tables"
                type="checkbox"
                className="h-4 w-4 accent-black"
                checked={derivedTablesEnabled}
                onChange={(event) => onDerivedTablesEnabledChange(event.target.checked)}
                disabled={busy}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button disabled={busy || isOpen} onClick={() => void onOpen()}>
              Open DB
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !isOpen}
              onClick={() => void onImportZip(fileInputRef.current?.files?.[0])}
            >
              <FileArchive className="h-4 w-4" />
              Import ZIP
            </Button>
            <Button variant="outline" disabled={busy || !isOpen} onClick={() => void onRefreshTables()}>
              List Tables
            </Button>
            <Button variant="outline" disabled={busy || !isOpen} onClick={() => void onClearDb()}>
              Clear DB
            </Button>
            <Button variant="ghost" className="col-span-2" disabled={busy || !isOpen} onClick={() => void onClose()}>
              <X className="h-4 w-4" />
              Close DB
            </Button>
          </div>

          <p className={cn("rounded-md border border-black bg-white px-3 py-2 text-sm", "text-black")}>{statusMessage}</p>
        </CardContent>
      </Card>

      <Card className="border-black bg-white">
        <CardHeader>
          <CardTitle>Import Progress</CardTitle>
          <CardDescription>ZIP import の進捗を表示します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">Import Progress</p>
            <p className="text-xs font-medium text-neutral-700">
              {completedCards}/{totalCards} ({overallProgressPercent}%)
            </p>
          </div>
          <div className="h-2 rounded-full border border-black bg-white">
            <div
              className="h-full rounded-full bg-black transition-[width] duration-200"
              style={{ width: `${overallProgressPercent}%` }}
            />
          </div>
          <div>
            {importProgress.tableCards.length === 0 ? (
              <p className="rounded-md border border-dashed border-black bg-white px-3 py-3 text-xs text-neutral-600">
                No table cards yet
              </p>
            ) : (
              <div className="grid gap-2 overflow-auto pr-1 sm:grid-cols-2">
                {importProgress.tableCards.map((card) => (
                  <TableProgressCardView key={card.name} card={card} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
