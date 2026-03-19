import type { ImportProgressEmitter } from "../../types.js";
import { AsyncQueue } from "../async-queue.js";
import { SqliteSession } from "../session.js";
import { type TableWriteState, writeTableChunk } from "./db-writer.js";
import type { ImportMetrics, QueuedChunk } from "./chunk.js";
import { emitSourceEvent } from "./progress.js";

type StartWriteWorkersArgs = {
  writerQueues: AsyncQueue<QueuedChunk>[];
  session: SqliteSession;
  insertBatchRowCount: number;
  skippedFiles: string[];
  metrics: ImportMetrics;
  emit: ImportProgressEmitter;
  hasError: () => boolean;
  setFirstError: (error: unknown, context?: { fileName?: string; tableName?: string }) => void;
};

export const startWriteWorkers = ({
  writerQueues,
  session,
  insertBatchRowCount,
  skippedFiles,
  metrics,
  emit,
  hasError,
  setFirstError,
}: StartWriteWorkersArgs): Promise<void>[] => {
  return writerQueues.map(async (queue) => {
    const tableStateByName = new Map<string, TableWriteState>();

    while (true) {
      if (hasError()) {
        return;
      }

      let message: QueuedChunk | undefined;
      try {
        message = await queue.shift();
      } catch (error) {
        setFirstError(error);
        return;
      }

      if (!message) {
        return;
      }

        if (message.isFirst && message.headers.length === 0) {
          skippedFiles.push(`${message.fileName} (empty)`);
          emitSourceEvent(emit, message.tableName, "skipped", `Import skipped: ${message.fileName}`);
          metrics.sourceTables.push({
            targetKind: "source",
            tableName: message.tableName,
            state: "skipped",
            rowsWritten: 0,
            skipReason: "empty header",
          });
          continue;
        }

        try {
          if (message.isFirst) {
            emitSourceEvent(emit, message.tableName, "running", `Import writing: ${message.fileName}`);
          }

          const result = await writeTableChunk(session, tableStateByName, message, insertBatchRowCount);

          if (result.rowsWritten > 0) {
            metrics.rowsImported += result.rowsWritten;
            emitSourceEvent(
              emit,
              message.tableName,
              "running",
              `Import chunk: ${message.fileName} (${result.rowsWritten} rows)`,
              result.rowsWritten,
            );
          }

        if (!message.isLast) {
          continue;
        }

        const state = tableStateByName.get(message.tableName);
        if (!state) {
          continue;
        }

        metrics.tablesImported += 1;
        if (!state.sawData) {
          skippedFiles.push(`${message.fileName} (empty)`);
          emitSourceEvent(emit, message.tableName, "skipped", `Import skipped: ${message.fileName}`);
          metrics.sourceTables.push({
            targetKind: "source",
            tableName: message.tableName,
            state: "skipped",
            rowsWritten: 0,
            skipReason: "empty file",
          });
        } else {
          emitSourceEvent(emit, message.tableName, "done", `Import done: ${message.fileName}`, state.rowsWritten);
          metrics.sourceTables.push({
            targetKind: "source",
            tableName: message.tableName,
            state: "done",
            rowsWritten: state.rowsWritten,
          });
        }

        tableStateByName.delete(message.tableName);
      } catch (error) {
        setFirstError(error, {
          fileName: message.fileName,
          tableName: message.tableName,
        });
        return;
      }
    }
  });
};
