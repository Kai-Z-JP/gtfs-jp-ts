import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import type { GtfsRow } from '@gtfs-jp/types';
import type { ImportProgressEvent, SqliteStorageMode } from '@gtfs-jp/loader';

import {
  createInitialImportProgress,
  type ImportProgressState,
  type OpfsSupport,
  reduceImportProgressState,
  type StatusMessage,
  type StatusType,
  type OrderCondition,
  type WhereCondition,
} from '../../domain/gtfsWorkbench';
import {
  detectOpfsSupport,
  GtfsLoaderAdapter,
  type GtfsLoaderPort,
} from '../../infrastructure/gtfsLoader';
import type { SampleDatabase } from '../../infrastructure/gtfsLoader/schema';

const TABLE_VIEW_BATCH_SIZE = 500;

type TableQueryState = {
  id: number;
  tableName: string;
  columns?: string[];
  whereConditions: WhereCondition[];
  orderConditions: OrderCondition[];
};

export type WorkbenchState = {
  storage: SqliteStorageMode;
  derivedTablesEnabled: boolean;
  status: StatusMessage;
  summary: string;
  tableNames: string[];
  selectedTable: string;
  rows: Array<GtfsRow | undefined>;
  loadedRowCount: number;
  tableQuery: TableQueryState | null;
  busy: boolean;
  importProgress: ImportProgressState;
  opfsSupport: OpfsSupport;
  isOpen: boolean;
  fileInputResetToken: number;
};

export type WorkbenchAction =
  | { type: 'set-storage'; storage: SqliteStorageMode }
  | { type: 'set-derived-tables-enabled'; enabled: boolean }
  | { type: 'set-selected-table'; selectedTable: string }
  | { type: 'set-busy'; busy: boolean }
  | { type: 'set-status'; status: StatusMessage }
  | { type: 'set-summary'; summary: string }
  | { type: 'reset-rows' }
  | {
      type: 'initialize-table-rows';
      tableQuery: TableQueryState;
      rowCount: number;
      initialRows: GtfsRow[];
    }
  | { type: 'merge-table-rows'; startIndex: number; rows: GtfsRow[] }
  | { type: 'sync-tables'; tableNames: string[] }
  | { type: 'set-import-progress'; importProgress: ImportProgressState }
  | { type: 'apply-import-progress'; event: ImportProgressEvent }
  | { type: 'connection-opened' }
  | { type: 'connection-closed' }
  | { type: 'increment-file-input-reset-token' };

export type WorkbenchActions = {
  setStorage: (storage: SqliteStorageMode) => void;
  setDerivedTablesEnabled: (enabled: boolean) => void;
  setSelectedTable: (selectedTable: string) => void;
  openDb: () => Promise<void>;
  closeDb: () => Promise<void>;
  refreshTables: () => Promise<void>;
  importZip: (file: File | undefined) => Promise<void>;
  clearDb: () => Promise<void>;
  readRows: (
    columns?: string[],
    whereConditions?: WhereCondition[],
    orderConditions?: OrderCondition[],
  ) => Promise<void>;
  loadRowsRange: (startIndex: number, endIndex: number) => void;
  getTableColumns: (tableName: string) => Promise<string[]>;
};

const getNestedErrorMessage = (
  error: unknown,
  seen = new WeakSet<object>(),
): string | undefined => {
  if (typeof error === 'string') {
    return error.trim() ? error : undefined;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if (seen.has(error)) {
    return undefined;
  }
  seen.add(error);

  const errorRecord = error as Record<string, unknown>;

  for (const key of ['message', 'reason', 'error'] as const) {
    const value = errorRecord[key];
    const message = getNestedErrorMessage(value, seen);
    if (message) {
      return message;
    }
  }

  return undefined;
};

const safeJsonStringify = (error: unknown): string | undefined => {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(error, (_key, value: unknown) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }

      return value;
    });
  } catch {
    return undefined;
  }
};

const getErrorMessage = (error: unknown): string => {
  const message = getNestedErrorMessage(error);
  if (message) {
    return message;
  }

  const serialized = safeJsonStringify(error);
  if (serialized && serialized !== '{}') {
    return serialized;
  }

  return String(error);
};

const createInitialWorkbenchState = (opfsSupport: OpfsSupport): WorkbenchState => ({
  storage: 'memory',
  derivedTablesEnabled: true,
  status: {
    type: 'warn',
    message: 'DB未接続',
  },
  summary: 'テーブル一覧を取得してください',
  tableNames: [],
  selectedTable: '',
  rows: [],
  loadedRowCount: 0,
  tableQuery: null,
  busy: false,
  importProgress: createInitialImportProgress(),
  opfsSupport,
  isOpen: false,
  fileInputResetToken: 0,
});

const workbenchReducer = (state: WorkbenchState, action: WorkbenchAction): WorkbenchState => {
  switch (action.type) {
    case 'set-storage':
      return {
        ...state,
        storage:
          action.storage === 'opfs' && !state.opfsSupport.available ? 'memory' : action.storage,
      };
    case 'set-derived-tables-enabled':
      return {
        ...state,
        derivedTablesEnabled: action.enabled,
      };
    case 'set-selected-table':
      return {
        ...state,
        selectedTable: action.selectedTable,
        rows: [],
        loadedRowCount: 0,
        tableQuery: null,
      };
    case 'set-busy':
      return {
        ...state,
        busy: action.busy,
      };
    case 'set-status':
      return {
        ...state,
        status: action.status,
      };
    case 'set-summary':
      return {
        ...state,
        summary: action.summary,
      };
    case 'reset-rows':
      return {
        ...state,
        rows: [],
        loadedRowCount: 0,
        tableQuery: null,
      };
    case 'initialize-table-rows': {
      const rows = Array.from({ length: action.rowCount }, (): GtfsRow | undefined => undefined);
      let loadedRowCount = 0;

      for (let index = 0; index < action.initialRows.length; index += 1) {
        rows[index] = action.initialRows[index];
        loadedRowCount += 1;
      }

      return {
        ...state,
        rows,
        loadedRowCount,
        tableQuery: action.tableQuery,
      };
    }
    case 'merge-table-rows': {
      const rows = [...state.rows];
      let loadedRowCount = state.loadedRowCount;

      for (let index = 0; index < action.rows.length; index += 1) {
        const targetIndex = action.startIndex + index;
        if (targetIndex >= rows.length) {
          break;
        }

        if (!rows[targetIndex]) {
          loadedRowCount += 1;
        }
        rows[targetIndex] = action.rows[index];
      }

      return {
        ...state,
        rows,
        loadedRowCount,
      };
    }
    case 'sync-tables': {
      if (action.tableNames.length === 0) {
        return {
          ...state,
          tableNames: action.tableNames,
          selectedTable: '',
          rows: [],
          loadedRowCount: 0,
          tableQuery: null,
        };
      }

      const selectedTable =
        state.selectedTable && action.tableNames.includes(state.selectedTable)
          ? state.selectedTable
          : action.tableNames[0];
      const tableChanged = selectedTable !== state.selectedTable;

      return {
        ...state,
        tableNames: action.tableNames,
        selectedTable,
        rows: tableChanged ? [] : state.rows,
        loadedRowCount: tableChanged ? 0 : state.loadedRowCount,
        tableQuery: tableChanged ? null : state.tableQuery,
      };
    }
    case 'set-import-progress':
      return {
        ...state,
        importProgress: action.importProgress,
      };
    case 'apply-import-progress':
      return {
        ...state,
        importProgress: reduceImportProgressState(state.importProgress, action.event),
      };
    case 'connection-opened':
      return {
        ...state,
        isOpen: true,
        summary: '接続済み。GTFS ZIP投入、またはテーブル一覧取得を実行してください。',
        tableNames: [],
        selectedTable: '',
        rows: [],
        loadedRowCount: 0,
        tableQuery: null,
      };
    case 'connection-closed':
      return {
        ...state,
        isOpen: false,
        summary: 'DB未接続',
        tableNames: [],
        selectedTable: '',
        rows: [],
        loadedRowCount: 0,
        tableQuery: null,
        fileInputResetToken: state.fileInputResetToken + 1,
      };
    case 'increment-file-input-reset-token':
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
  const message = getErrorMessage(error);
  setStatusMessage(`${prefix}: ${message}`, 'error');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const applyWhereConditions = (query: any, whereConditions: WhereCondition[] = []): any => {
  let nextQuery = query;

  for (const cond of whereConditions) {
    if (cond.operator === 'is' || cond.operator === 'is not') {
      nextQuery = nextQuery.where(cond.column, cond.operator, null);
    } else if (cond.operator === 'in' || cond.operator === 'not in') {
      const values = cond.value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      nextQuery = nextQuery.where(cond.column, cond.operator, values);
    } else {
      nextQuery = nextQuery.where(cond.column, cond.operator, cond.value);
    }
  }

  return nextQuery;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const applyOrderConditions = (query: any, orderConditions: OrderCondition[] = []): any => {
  let nextQuery = query;

  for (const ord of orderConditions) {
    nextQuery = nextQuery.orderBy(ord.column, ord.direction);
  }

  return nextQuery;
};

const toRowCount = (value: unknown): number => {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export function useGtfsWorkbench(): {
  state: WorkbenchState;
  actions: WorkbenchActions;
  loader: GtfsLoaderPort<SampleDatabase> | null;
} {
  const opfsSupport = useMemo(() => detectOpfsSupport(), []);
  const [state, dispatch] = useReducer(workbenchReducer, opfsSupport, createInitialWorkbenchState);

  const loaderRef = useRef<GtfsLoaderPort<SampleDatabase> | undefined>(undefined);
  const tableQueryIdRef = useRef(0);
  const activeTableQueryRef = useRef<TableQueryState | null>(null);
  const loadingBatchKeysRef = useRef<Set<string>>(new Set());
  const [loader, setLoader] = useState<GtfsLoaderPort<SampleDatabase> | null>(null);

  const clearActiveTableQuery = useCallback(() => {
    activeTableQueryRef.current = null;
    loadingBatchKeysRef.current.clear();
  }, []);

  const setStatusMessage = useCallback((message: string, type: StatusType) => {
    dispatch({ type: 'set-status', status: { message, type } });
  }, []);

  const setDerivedTablesEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'set-derived-tables-enabled', enabled });
    loaderRef.current?.setDerivedTablesEnabled(enabled);
  }, []);

  const closeCurrentLoader = useCallback(async () => {
    if (!loaderRef.current) {
      return;
    }

    await loaderRef.current.close();
    loaderRef.current = undefined;
    setLoader(null);
  }, []);

  useEffect(() => {
    return () => {
      void closeCurrentLoader();
    };
  }, [closeCurrentLoader]);

  useEffect(() => {
    if (state.tableQuery) {
      activeTableQueryRef.current = state.tableQuery;
    }
  }, [state.tableQuery]);

  const refreshTables = useCallback(async () => {
    if (!loaderRef.current) {
      return;
    }

    const names = await loaderRef.current.listAllTables();
    dispatch({ type: 'sync-tables', tableNames: names });

    if (names.length === 0) {
      dispatch({ type: 'set-summary', summary: 'テーブルが見つかりません' });
      return;
    }

    dispatch({ type: 'set-summary', summary: `${names.length} tables: ${names.join(', ')}` });
  }, []);

  const openDb = useCallback(async () => {
    dispatch({ type: 'set-busy', busy: true });
    try {
      if (state.storage === 'opfs' && !state.opfsSupport.available) {
        setStatusMessage(
          `OPFSを利用できません: ${state.opfsSupport.reason ?? '環境未対応'}`,
          'warn',
        );
        return;
      }

      clearActiveTableQuery();
      await closeCurrentLoader();

      const nextLoader = new GtfsLoaderAdapter({
        storage: state.storage,
        filename: 'gtfs-jp-v4-sample.sqlite3',
      });
      nextLoader.setDerivedTablesEnabled(state.derivedTablesEnabled);
      await nextLoader.open();
      loaderRef.current = nextLoader;
      setLoader(nextLoader);

      dispatch({ type: 'connection-opened' });
      setStatusMessage(
        `接続完了: ${state.storage} (${new Date().toLocaleTimeString('ja-JP')})`,
        'ok',
      );
    } catch (error) {
      handleError(error, 'DB接続に失敗しました', setStatusMessage);
    } finally {
      dispatch({ type: 'set-busy', busy: false });
    }
  }, [
    closeCurrentLoader,
    clearActiveTableQuery,
    setStatusMessage,
    state.derivedTablesEnabled,
    state.opfsSupport.available,
    state.opfsSupport.reason,
    state.storage,
  ]);

  const closeDb = useCallback(async () => {
    dispatch({ type: 'set-busy', busy: true });
    try {
      clearActiveTableQuery();
      await closeCurrentLoader();
      dispatch({ type: 'connection-closed' });
      setStatusMessage('DBをクローズしました', 'ok');
    } finally {
      dispatch({ type: 'set-busy', busy: false });
    }
  }, [clearActiveTableQuery, closeCurrentLoader, setStatusMessage]);

  const importZip = useCallback(
    async (file: File | undefined) => {
      if (!loaderRef.current) {
        return;
      }

      if (!file) {
        setStatusMessage('GTFS ZIPファイルを選択してください', 'warn');
        return;
      }

      dispatch({ type: 'set-busy', busy: true });
      dispatch({
        type: 'set-import-progress',
        importProgress: {
          ...createInitialImportProgress(),
          phase: 'prepare',
        },
      });

      try {
        const startedAt = performance.now();
        const result = await loaderRef.current.importGtfsZip(file, (event) => {
          dispatch({ type: 'apply-import-progress', event });
        });

        const elapsedSeconds = (performance.now() - startedAt) / 1000;
        const elapsedLabel = `${elapsedSeconds.toFixed(2)}s`;

        await refreshTables();

        const skipped =
          result.skippedFiles.length > 0 ? ` / skipped: ${result.skippedFiles.join(', ')}` : '';
        const skippedDerived =
          result.skippedDerivedTables.length > 0
            ? ` / skipped derived: ${result.skippedDerivedTables.join(', ')}`
            : '';
        dispatch({
          type: 'set-summary',
          summary: `ZIP import done: ${result.tablesImported} source tables, ${result.rowsImported} source rows, ${result.derivedTablesMaterialized} derived tables, ${result.derivedRowsWritten} derived rows, ${elapsedLabel}${skipped}${skippedDerived}`,
        });
        setStatusMessage(
          `ZIP取込完了: ${result.tablesImported} source / ${result.derivedTablesMaterialized} derived (${elapsedLabel})`,
          'ok',
        );
      } catch (error) {
        handleError(error, 'ZIP取込に失敗しました', setStatusMessage);
      } finally {
        dispatch({ type: 'set-busy', busy: false });
      }
    },
    [refreshTables, setStatusMessage],
  );

  const clearDb = useCallback(async () => {
    if (!loaderRef.current) {
      return;
    }

    const confirmed = globalThis.confirm(
      '現在のDBを削除して再作成します。この操作は元に戻せません。続行しますか？',
    );
    if (!confirmed) {
      setStatusMessage('DBクリアをキャンセルしました', 'warn');
      return;
    }

    dispatch({ type: 'set-busy', busy: true });
    try {
      clearActiveTableQuery();
      await loaderRef.current.clearDatabase();
      await refreshTables();
      dispatch({ type: 'reset-rows' });
      dispatch({ type: 'increment-file-input-reset-token' });
      setStatusMessage('DBを削除して再作成しました', 'ok');
    } catch (error) {
      handleError(error, 'DBクリアに失敗しました', setStatusMessage);
    } finally {
      dispatch({ type: 'set-busy', busy: false });
    }
  }, [clearActiveTableQuery, refreshTables, setStatusMessage]);

  const getTableColumns = useCallback(async (tableName: string): Promise<string[]> => {
    if (!loaderRef.current || !tableName) return [];
    const tables = await loaderRef.current.getKyselyDb().introspection.getTables();
    const columns = tables.find((t) => t.name === tableName)?.columns ?? [];
    return columns.map((c) => c.name);
  }, []);

  const fetchRowCount = useCallback(async (tableQuery: TableQueryState): Promise<number> => {
    if (!loaderRef.current) {
      return 0;
    }

    const db = loaderRef.current.getKyselyDb();

    const baseQuery = db
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .selectFrom(tableQuery.tableName as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select((eb: any) => eb.fn.countAll().as('count'));
    const countRow = (await applyWhereConditions(
      baseQuery,
      tableQuery.whereConditions,
    ).executeTakeFirst()) as
      | {
          count?: unknown;
        }
      | undefined;

    return toRowCount(countRow?.count);
  }, []);

  const fetchRowsBatch = useCallback(
    async (tableQuery: TableQueryState, startIndex: number, limit: number): Promise<GtfsRow[]> => {
      if (!loaderRef.current || limit <= 0) {
        return [];
      }

      const db = loaderRef.current.getKyselyDb();
      const selectedColumns = tableQuery.columns;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = db.selectFrom(tableQuery.tableName as any);

      if (selectedColumns && selectedColumns.length > 0) {
        query = query.select(selectedColumns);
      } else {
        query = query.selectAll();
      }

      query = applyWhereConditions(query, tableQuery.whereConditions);
      query = applyOrderConditions(query, tableQuery.orderConditions);

      return (await query.limit(limit).offset(startIndex).execute()) as GtfsRow[];
    },
    [],
  );

  const readRows = useCallback(
    async (
      columns?: string[],
      whereConditions?: WhereCondition[],
      orderConditions?: OrderCondition[],
    ) => {
      if (!loaderRef.current) {
        return;
      }

      if (!state.selectedTable) {
        setStatusMessage('テーブルを選択してください', 'warn');
        return;
      }

      const tableQuery: TableQueryState = {
        id: (tableQueryIdRef.current += 1),
        tableName: state.selectedTable,
        columns: columns && columns.length > 0 ? [...columns] : undefined,
        whereConditions: [...(whereConditions ?? [])],
        orderConditions: [...(orderConditions ?? [])],
      };

      activeTableQueryRef.current = tableQuery;
      loadingBatchKeysRef.current.clear();
      dispatch({ type: 'set-busy', busy: true });
      dispatch({ type: 'reset-rows' });
      try {
        const rowCount = await fetchRowCount(tableQuery);
        const initialRows = await fetchRowsBatch(
          tableQuery,
          0,
          Math.min(TABLE_VIEW_BATCH_SIZE, rowCount),
        );

        if (activeTableQueryRef.current?.id !== tableQuery.id) {
          return;
        }

        dispatch({
          type: 'initialize-table-rows',
          tableQuery,
          rowCount,
          initialRows,
        });
        setStatusMessage(
          `${tableQuery.tableName}: ${initialRows.length} / ${rowCount} row(s) loaded`,
          'ok',
        );
      } catch (error) {
        handleError(error, `${state.selectedTable} の読込に失敗しました`, setStatusMessage);
      } finally {
        dispatch({ type: 'set-busy', busy: false });
      }
    },
    [fetchRowCount, fetchRowsBatch, setStatusMessage, state.selectedTable],
  );

  const loadRowsRange = useCallback(
    (startIndex: number, endIndex: number) => {
      const tableQuery = state.tableQuery;
      if (!loaderRef.current || !tableQuery || state.rows.length === 0) {
        return;
      }

      const clampedStartIndex = Math.max(0, Math.min(startIndex, state.rows.length));
      const clampedEndIndex = Math.max(clampedStartIndex, Math.min(endIndex, state.rows.length));
      if (clampedStartIndex === clampedEndIndex) {
        return;
      }

      const firstBatchStart =
        Math.floor(clampedStartIndex / TABLE_VIEW_BATCH_SIZE) * TABLE_VIEW_BATCH_SIZE;
      const lastBatchStart =
        Math.floor((clampedEndIndex - 1) / TABLE_VIEW_BATCH_SIZE) * TABLE_VIEW_BATCH_SIZE;
      const batchStarts: number[] = [];

      for (
        let batchStart = firstBatchStart;
        batchStart <= lastBatchStart;
        batchStart += TABLE_VIEW_BATCH_SIZE
      ) {
        const batchEnd = Math.min(batchStart + TABLE_VIEW_BATCH_SIZE, state.rows.length);
        const hasMissingRows = state.rows
          .slice(batchStart, batchEnd)
          .some((row) => row === undefined);
        const batchKey = `${tableQuery.id}:${batchStart}`;

        if (hasMissingRows && !loadingBatchKeysRef.current.has(batchKey)) {
          loadingBatchKeysRef.current.add(batchKey);
          batchStarts.push(batchStart);
        }
      }

      if (batchStarts.length === 0) {
        return;
      }

      void Promise.all(
        batchStarts.map(async (batchStart) => {
          const batchKey = `${tableQuery.id}:${batchStart}`;

          try {
            const rows = await fetchRowsBatch(
              tableQuery,
              batchStart,
              Math.min(TABLE_VIEW_BATCH_SIZE, state.rows.length - batchStart),
            );

            if (activeTableQueryRef.current?.id === tableQuery.id) {
              dispatch({ type: 'merge-table-rows', startIndex: batchStart, rows });
            }
          } catch (error) {
            if (activeTableQueryRef.current?.id === tableQuery.id) {
              handleError(
                error,
                `${tableQuery.tableName} の追加読込に失敗しました`,
                setStatusMessage,
              );
            }
          } finally {
            loadingBatchKeysRef.current.delete(batchKey);
          }
        }),
      );
    },
    [fetchRowsBatch, setStatusMessage, state.rows, state.tableQuery],
  );

  const actions = useMemo<WorkbenchActions>(
    () => ({
      setStorage: (storage) => dispatch({ type: 'set-storage', storage }),
      setDerivedTablesEnabled,
      setSelectedTable: (selectedTable) => {
        clearActiveTableQuery();
        dispatch({ type: 'set-selected-table', selectedTable });
      },
      openDb,
      closeDb,
      refreshTables,
      importZip,
      clearDb,
      readRows,
      loadRowsRange,
      getTableColumns,
    }),
    [
      clearDb,
      clearActiveTableQuery,
      closeDb,
      getTableColumns,
      importZip,
      loadRowsRange,
      openDb,
      readRows,
      refreshTables,
      setDerivedTablesEnabled,
    ],
  );

  return {
    state,
    actions,
    loader,
  };
}
