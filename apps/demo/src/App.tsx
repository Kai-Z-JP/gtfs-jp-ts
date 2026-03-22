import {useState} from "react";

import {Badge} from "./components/ui/badge";
import {Button} from "./components/ui/button";
import {useGtfsWorkbench} from "./application/gtfsWorkbench";
import {TableViewerPanel, WorkflowPanel} from "./presentation/gtfsWorkbench";

type MainTab = "workflow" | "viewer";

export default function App(): JSX.Element {
  const [mainTab, setMainTab] = useState<MainTab>("workflow");
  const {state, actions} = useGtfsWorkbench();

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-6 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">GTFS-JP v4 demo</h1>
          <p className="max-w-3xl text-sm text-neutral-700 md:text-base">
            in-memory / OPFS を切り替えて GTFS ZIP を読み込み、テーブルを確認できます。
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant={mainTab === "workflow" ? "default" : "outline"} onClick={() => setMainTab("workflow")}>
            Load
          </Button>
          <Button variant={mainTab === "viewer" ? "default" : "outline"} onClick={() => setMainTab("viewer")}>
            Table Viewer
          </Button>
        </div>

        {mainTab === "workflow" ? (
          <WorkflowPanel
            storage={state.storage}
            derivedTablesEnabled={state.derivedTablesEnabled}
            opfsSupport={state.opfsSupport}
            statusMessage={state.status.message}
            busy={state.busy}
            isOpen={state.isOpen}
            fileInputResetToken={state.fileInputResetToken}
            importProgress={state.importProgress}
            onStorageChange={actions.setStorage}
            onDerivedTablesEnabledChange={actions.setDerivedTablesEnabled}
            onOpen={actions.openDb}
            onImportZip={actions.importZip}
            onRefreshTables={actions.refreshTables}
            onClearDb={actions.clearDb}
            onClose={actions.closeDb}
          />
        ) : (
          <TableViewerPanel
            summary={state.summary}
            selectedTable={state.selectedTable}
            tableNames={state.tableNames}
            limit={state.limit}
            rows={state.rows}
            busy={state.busy}
            isOpen={state.isOpen}
            onSelectedTableChange={actions.setSelectedTable}
            onLimitChange={actions.setLimit}
            onReadRows={actions.readRows}
          />
        )}
      </div>
    </main>
  );
}
