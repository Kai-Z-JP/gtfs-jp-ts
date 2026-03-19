import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type { GtfsRow } from "@gtfs-jp/types";
import type { ImportProgressEvent, SqliteStorageMode } from "@gtfs-jp/loader";

import {
  createInitialImportProgress,
  parseLimit,
  reduceImportProgressState,
  type ImportProgressState,
  type OpfsSupport,
  type StatusMessage,
  type StatusType,
} from "../../domain/gtfsWorkbench";
import { detectOpfsSupport, GtfsLoaderAdapter, type GtfsLoaderPort } from "../../infrastructure/gtfsLoader";

export type WorkbenchState = {
  storage: SqliteStorageMode;
  status: StatusMessage;
  summary: string;
  tableNames: string[];
  selectedTable: string;
  rows: GtfsRow[];
  limit: string;
  busy: boolean;
  importProgress: ImportProgressState;
  opfsSupport: OpfsSupport;
  isOpen: boolean;
  fileInputResetToken: number;
};

export type WorkbenchAction =
  | { type: "set-storage"; storage: SqliteStorageMode }
  | { type: "set-selected-table"; selectedTable: string }
  | { type: "set-limit"; limit: string }
  | { type: "set-busy"; busy: boolean }
  | { type: "set-status"; status: StatusMessage }
  | { type: "set-summary"; summary: string }
  | { type: "set-rows"; rows: GtfsRow[] }
  | { type: "sync-tables"; tableNames: string[] }
  | { type: "set-import-progress"; importProgress: ImportProgressState }
  | { type: "apply-import-progress"; event: ImportProgressEvent }
  | { type: "connection-opened" }
  | { type: "connection-closed" }
  | { type: "increment-file-input-reset-token" };

export type WorkbenchActions = {
  setStorage: (storage: SqliteStorageMode) => void;
  setSelectedTable: (selectedTable: string) => void;
  setLimit: (limit: string) => void;
  openDb: () => Promise<void>;
  closeDb: () => Promise<void>;
  refreshTables: () => Promise<void>;
  importZip: (file: File | undefined) => Promise<void>;
  clearDb: () => Promise<void>;
  readRows: () => Promise<void>;
};

const createInitialWorkbenchState = (opfsSupport: OpfsSupport): WorkbenchState => ({
  storage: "memory",
  status: {
    type: "warn",
    message: "DB未接続",
  },
  summary: "テーブル一覧を取得してください",
  tableNames: [],
  selectedTable: "",
  rows: [],
  limit: "50",
  busy: false,
  importProgress: createInitialImportProgress(),
  opfsSupport,
  isOpen: false,
  fileInputResetToken: 0,
});

const workbenchReducer = (state: WorkbenchState, action: WorkbenchAction): WorkbenchState => {
  switch (action.type) {
    case "set-storage":
      return {
        ...state,
        storage: action.storage === "opfs" && !state.opfsSupport.available ? "memory" : action.storage,
      };
    case "set-selected-table":
      return {
        ...state,
        selectedTable: action.selectedTable,
      };
    case "set-limit":
      return {
        ...state,
        limit: action.limit,
      };
    case "set-busy":
      return {
        ...state,
        busy: action.busy,
      };
    case "set-status":
      return {
        ...state,
        status: action.status,
      };
    case "set-summary":
      return {
        ...state,
        summary: action.summary,
      };
    case "set-rows":
      return {
        ...state,
        rows: action.rows,
      };
    case "sync-tables": {
      if (action.tableNames.length === 0) {
        return {
          ...state,
          tableNames: action.tableNames,
          selectedTable: "",
          rows: [],
        };
      }

      return {
        ...state,
        tableNames: action.tableNames,
        selectedTable:
          state.selectedTable && action.tableNames.includes(state.selectedTable)
            ? state.selectedTable
            : action.tableNames[0],
      };
    }
    case "set-import-progress":
      return {
        ...state,
        importProgress: action.importProgress,
      };
    case "apply-import-progress":
      return {
        ...state,
        importProgress: reduceImportProgressState(state.importProgress, action.event),
      };
    case "connection-opened":
      return {
        ...state,
        isOpen: true,
        summary: "接続済み。GTFS ZIP投入、またはテーブル一覧取得を実行してください。",
        tableNames: [],
        selectedTable: "",
        rows: [],
      };
    case "connection-closed":
      return {
        ...state,
        isOpen: false,
        summary: "DB未接続",
        tableNames: [],
        selectedTable: "",
        rows: [],
        fileInputResetToken: state.fileInputResetToken + 1,
      };
    case "increment-file-input-reset-token":
      return {
        ...state,
        fileInputResetToken: state.fileInputResetToken + 1,
      };
    default:
      return state;
  }
};

const handleError = (
  error: unknown,
  prefix: string,
  setStatusMessage: (message: string, type: StatusType) => void,
): void => {
  const message = error instanceof Error ? error.message : String(error);
  setStatusMessage(`${prefix}: ${message}`, "error");
};

export function useGtfsWorkbench(): { state: WorkbenchState; actions: WorkbenchActions } {
  const opfsSupport = useMemo(() => detectOpfsSupport(), []);
  const [state, dispatch] = useReducer(workbenchReducer, opfsSupport, createInitialWorkbenchState);

  const loaderRef = useRef<GtfsLoaderPort | undefined>(undefined);

  const setStatusMessage = useCallback((message: string, type: StatusType) => {
    dispatch({ type: "set-status", status: { message, type } });
  }, []);

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
    dispatch({ type: "sync-tables", tableNames: names });

    if (names.length === 0) {
      dispatch({ type: "set-summary", summary: "テーブルが見つかりません" });
      return;
    }

    dispatch({ type: "set-summary", summary: `${names.length} tables: ${names.join(", ")}` });
  }, []);

  const openDb = useCallback(async () => {
    dispatch({ type: "set-busy", busy: true });
    try {
      if (state.storage === "opfs" && !state.opfsSupport.available) {
        setStatusMessage(`OPFSを利用できません: ${state.opfsSupport.reason ?? "環境未対応"}`, "warn");
        return;
      }

      await closeCurrentLoader();

      const nextLoader = new GtfsLoaderAdapter({
        storage: state.storage,
        filename: "gtfs-jp-v4-sample.sqlite3",
      });
      await nextLoader.open();
      loaderRef.current = nextLoader;

      dispatch({ type: "connection-opened" });
      setStatusMessage(`接続完了: ${state.storage} (${new Date().toLocaleTimeString("ja-JP")})`, "ok");
    } catch (error) {
      handleError(error, "DB接続に失敗しました", setStatusMessage);
    } finally {
      dispatch({ type: "set-busy", busy: false });
    }
  }, [closeCurrentLoader, setStatusMessage, state.opfsSupport.available, state.opfsSupport.reason, state.storage]);

  const closeDb = useCallback(async () => {
    dispatch({ type: "set-busy", busy: true });
    try {
      await closeCurrentLoader();
      dispatch({ type: "connection-closed" });
      setStatusMessage("DBをクローズしました", "ok");
    } finally {
      dispatch({ type: "set-busy", busy: false });
    }
  }, [closeCurrentLoader, setStatusMessage]);

  const importZip = useCallback(
    async (file: File | undefined) => {
      if (!loaderRef.current) {
        return;
      }

      if (!file) {
        setStatusMessage("GTFS ZIPファイルを選択してください", "warn");
        return;
      }

      dispatch({ type: "set-busy", busy: true });
      dispatch({
        type: "set-import-progress",
        importProgress: {
          ...createInitialImportProgress(),
          phase: "prepare",
        },
      });

      try {
        const startedAt = performance.now();
        const result = await loaderRef.current.importGtfsZip(file, (event) => {
          dispatch({ type: "apply-import-progress", event });
        });

        const elapsedSeconds = (performance.now() - startedAt) / 1000;
        const elapsedLabel = `${elapsedSeconds.toFixed(2)}s`;

        await refreshTables();

        const skipped = result.skippedFiles.length > 0 ? ` / skipped: ${result.skippedFiles.join(", ")}` : "";
        dispatch({
          type: "set-summary",
          summary: `ZIP import done: ${result.tablesImported} tables, ${result.rowsImported} rows, ${elapsedLabel}${skipped}`,
        });
        setStatusMessage(`ZIP取込完了: ${result.tablesImported} tables (${elapsedLabel})`, "ok");
      } catch (error) {
        handleError(error, "ZIP取込に失敗しました", setStatusMessage);
      } finally {
        dispatch({ type: "set-busy", busy: false });
      }
    },
    [refreshTables, setStatusMessage],
  );

  const clearDb = useCallback(async () => {
    if (!loaderRef.current) {
      return;
    }

    const confirmed = globalThis.confirm(
      "現在のDBを削除して再作成します。この操作は元に戻せません。続行しますか？",
    );
    if (!confirmed) {
      setStatusMessage("DBクリアをキャンセルしました", "warn");
      return;
    }

    dispatch({ type: "set-busy", busy: true });
    try {
      await loaderRef.current.clearDatabase();
      await refreshTables();
      dispatch({ type: "increment-file-input-reset-token" });
      setStatusMessage("DBを削除して再作成しました", "ok");
    } catch (error) {
      handleError(error, "DBクリアに失敗しました", setStatusMessage);
    } finally {
      dispatch({ type: "set-busy", busy: false });
    }
  }, [refreshTables, setStatusMessage]);

  const readRows = useCallback(async () => {
    if (!loaderRef.current) {
      return;
    }

    if (!state.selectedTable) {
      setStatusMessage("テーブルを選択してください", "warn");
      return;
    }

    const parsedLimit = parseLimit(state.limit);
    if (!parsedLimit.ok) {
      setStatusMessage(parsedLimit.errorMessage, "warn");
      return;
    }

    dispatch({ type: "set-busy", busy: true });
    try {
      const loadedRows = await loaderRef.current.readRows(state.selectedTable, parsedLimit.value);
      dispatch({ type: "set-rows", rows: loadedRows });
      setStatusMessage(`${state.selectedTable}: ${loadedRows.length} row(s)`, "ok");
    } catch (error) {
      handleError(error, `${state.selectedTable} の読込に失敗しました`, setStatusMessage);
    } finally {
      dispatch({ type: "set-busy", busy: false });
    }
  }, [setStatusMessage, state.limit, state.selectedTable]);

  const actions = useMemo<WorkbenchActions>(
    () => ({
      setStorage: (storage) => dispatch({ type: "set-storage", storage }),
      setSelectedTable: (selectedTable) => dispatch({ type: "set-selected-table", selectedTable }),
      setLimit: (limit) => dispatch({ type: "set-limit", limit }),
      openDb,
      closeDb,
      refreshTables,
      importZip,
      clearDb,
      readRows,
    }),
    [clearDb, closeDb, importZip, openDb, readRows, refreshTables],
  );

  return {
    state,
    actions,
  };
}
