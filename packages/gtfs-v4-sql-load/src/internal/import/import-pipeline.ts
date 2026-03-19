import JSZip from "jszip";

import type {
  ImportGtfsZipOptions,
  ImportGtfsZipResult,
  ImportProgressEmitter,
  SqliteStorageMode,
} from "../../types.js";
import { AsyncQueue } from "../async-queue.js";
import { withOpfsImportWriteTuning } from "../opfs-pragmas.js";
import { SqliteSession } from "../session.js";
import type { ImportMetrics, QueuedChunk } from "./chunk.js";
import { collectImportTargets } from "./import-targets.js";
import { emitTableEvent } from "./progress.js";
import { startParseWorkers } from "./parse-workers.js";
import { startWriteWorkers } from "./write-workers.js";

type ImportIntoSessionArgs = {
  session: SqliteSession;
  mode: SqliteStorageMode;
  strictGtfsTableName: boolean;
  file: File | Blob | ArrayBuffer | Uint8Array;
  options: ImportGtfsZipOptions;
  emit: ImportProgressEmitter;
};

const toArrayBuffer = async (value: File | Blob | ArrayBuffer | Uint8Array): Promise<ArrayBuffer> => {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (value instanceof Uint8Array) {
    const copied = new Uint8Array(value.byteLength);
    copied.set(value);
    return copied.buffer;
  }

  return await value.arrayBuffer();
};

const normalizeConcurrency = (value: number | undefined, maxValue: number): number => {
  if (value !== undefined) {
    return Math.max(1, Math.min(maxValue, Math.floor(value)));
  }

  const detected = globalThis.navigator?.hardwareConcurrency ?? 4;
  return Math.max(1, Math.min(maxValue, detected));
};

export const importZipIntoSession = async ({
  session,
  mode,
  strictGtfsTableName,
  file,
  options,
  emit,
}: ImportIntoSessionArgs): Promise<ImportGtfsZipResult> => {
  const archive = await JSZip.loadAsync(await toArrayBuffer(file));
  const { targets, skippedFiles } = collectImportTargets({
    archive,
    strictGtfsTableName,
  });

  emit({
    phase: "prepare",
    message: `Import targets prepared: ${targets.length} files`,
    targets: targets.map((target) => ({
      fileName: target.fileName,
      tableName: target.tableName,
    })),
  });

  const parseWorkerConcurrency = normalizeConcurrency(options.parseWorkerConcurrency, 8);
  const dbWriteConcurrency =
    options.dbWriteConcurrency === undefined
      ? mode === "opfs"
        ? 1
        : normalizeConcurrency(undefined, 4)
      : normalizeConcurrency(options.dbWriteConcurrency, 8);

  const parseChunkRowCount = Math.max(
    1,
    Math.floor(options.parseChunkRowCount ?? (mode === "opfs" ? 1000 : 500)),
  );
  const insertBatchRowCount = Math.max(
    1,
    Math.floor(options.insertBatchRowCount ?? (mode === "opfs" ? 1000 : 250)),
  );

  const writerCount = Math.min(Math.max(1, dbWriteConcurrency), targets.length);
  const writerQueues = Array.from({ length: writerCount }, () => new AsyncQueue<QueuedChunk>());

  const metrics: ImportMetrics = {
    tablesImported: 0,
    rowsImported: 0,
  };

  let hasError = false;
  let firstError: unknown;

  const setFirstError = (error: unknown, context?: { fileName?: string; tableName?: string }): void => {
    if (hasError) {
      return;
    }

    hasError = true;
    firstError = error;

    for (const queue of writerQueues) {
      queue.fail(error);
    }

    if (context?.fileName && context.tableName) {
      const message = error instanceof Error ? error.message : String(error);
      emitTableEvent(
        emit,
        "parse",
        context.fileName,
        context.tableName,
        "error",
        `${context.fileName}: ${message}`,
      );
    }
  };

  const runInTransaction = async (): Promise<void> => {
    await session.exec(mode === "opfs" ? "BEGIN IMMEDIATE;" : "BEGIN;");

    try {
      const writeWorkers = startWriteWorkers({
        writerQueues,
        session,
        insertBatchRowCount,
        skippedFiles,
        metrics,
        emit,
        hasError: () => hasError,
        setFirstError,
      });

      const parseWorkers = startParseWorkers({
        parseWorkerConcurrency,
        parseChunkRowCount,
        targets,
        writerQueues,
        writerCount,
        emit,
        hasError: () => hasError,
        setFirstError,
      });

      await Promise.all(parseWorkers);

      if (!hasError) {
        for (const queue of writerQueues) {
          queue.close();
        }
      }

      await Promise.all(writeWorkers);
      if (hasError) {
        throw firstError ?? new Error("Import failed");
      }

      await session.exec("COMMIT;");
    } catch (error) {
      await session.exec("ROLLBACK;");
      throw error;
    }
  };

  if (mode === "opfs") {
    await withOpfsImportWriteTuning(session, runInTransaction);
  } else {
    await runInTransaction();
  }

  return {
    tablesImported: metrics.tablesImported,
    rowsImported: metrics.rowsImported,
    skippedFiles,
  };
};
