import type { ImportProgressEmitter } from "../../types.js";
import { AsyncQueue } from "../async-queue.js";
import { SqliteSession } from "../session.js";
import { type TableWriteState, writeTableChunk } from "./db-writer.js";
import type { ImportMetrics, QueuedChunk } from "./chunk.js";
import { emitTableEvent } from "./progress.js";

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
        emitTableEvent(
          emit,
          "write",
          message.fileName,
          message.tableName,
          "skipped",
          `DB write skipped: ${message.fileName} (empty header)`,
        );
        continue;
      }

      try {
        if (message.isFirst) {
          emitTableEvent(
            emit,
            "write",
            message.fileName,
            message.tableName,
            "writing",
            `DB write started: ${message.fileName}`,
          );
        }

        const result = await writeTableChunk(session, tableStateByName, message, insertBatchRowCount);

        if (result.rowsWritten > 0) {
          metrics.rowsImported += result.rowsWritten;
          emitTableEvent(
            emit,
            "write",
            message.fileName,
            message.tableName,
            "writing",
            `DB write chunk: ${message.fileName} (${result.rowsWritten} rows)`,
            {
              writtenRows: result.rowsWritten,
              chunkIndex: message.chunkIndex,
              chunkRows: result.rowsWritten,
            },
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
          emitTableEvent(
            emit,
            "write",
            message.fileName,
            message.tableName,
            "skipped",
            `DB write skipped: ${message.fileName}`,
          );
        } else {
          emitTableEvent(
            emit,
            "write",
            message.fileName,
            message.tableName,
            "done",
            `DB write done: ${message.fileName}`,
            { writtenRows: state.rowsWritten },
          );
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
