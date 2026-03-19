import type { ImportProgressEmitter } from "../../types.js";
import { AsyncQueue } from "../async-queue.js";
import { ParseWorkerClient } from "./parse-worker-client.js";
import type { QueuedChunk } from "./chunk.js";
import type { ImportTarget } from "./import-targets.js";
import { emitTableEvent } from "./progress.js";

type StartParseWorkersArgs = {
  parseWorkerConcurrency: number;
  parseChunkRowCount: number;
  targets: ImportTarget[];
  writerQueues: AsyncQueue<QueuedChunk>[];
  writerCount: number;
  emit: ImportProgressEmitter;
  hasError: () => boolean;
  setFirstError: (error: unknown, context?: { fileName?: string; tableName?: string }) => void;
};

export const startParseWorkers = ({
  parseWorkerConcurrency,
  parseChunkRowCount,
  targets,
  writerQueues,
  writerCount,
  emit,
  hasError,
  setFirstError,
}: StartParseWorkersArgs): Promise<void>[] => {
  let nextParseIndex = 0;

  return Array.from(
    {
      length: Math.min(Math.max(1, parseWorkerConcurrency), targets.length),
    },
    async () => {
      const parseWorker = new ParseWorkerClient();
      try {
        while (true) {
          if (hasError()) {
            return;
          }

          const index = nextParseIndex;
          nextParseIndex += 1;
          if (index >= targets.length) {
            return;
          }

          const target = targets[index];
          const writerQueue = writerQueues[target.index % writerCount];

          emitTableEvent(
            emit,
            "parse",
            target.fileName,
            target.tableName,
            "parsing",
            `ZIP parse started: ${target.fileName}`,
          );

          let chunkIndex = 0;
          try {
            const bytes = await target.entry.async("uint8array");
            await parseWorker.parse(
              target.fileName,
              target.tableName,
              bytes,
              parseChunkRowCount,
              {
                onStart: (headers) => {
                  writerQueue.push({
                    fileName: target.fileName,
                    tableName: target.tableName,
                    headers,
                    rows: [],
                    isFirst: true,
                    isLast: false,
                    chunkIndex: -1,
                  });
                },
                onChunk: (nextChunkIndex, rows) => {
                  chunkIndex = nextChunkIndex;
                  writerQueue.push({
                    fileName: target.fileName,
                    tableName: target.tableName,
                    headers: [],
                    rows,
                    isFirst: false,
                    isLast: false,
                    chunkIndex: nextChunkIndex,
                  });
                },
                onDone: (parsedRows) => {
                  writerQueue.push({
                    fileName: target.fileName,
                    tableName: target.tableName,
                    headers: [],
                    rows: [],
                    isFirst: false,
                    isLast: true,
                    chunkIndex,
                  });

                  emitTableEvent(
                    emit,
                    "parse",
                    target.fileName,
                    target.tableName,
                    "parsed",
                    `ZIP parse done: ${target.fileName}`,
                    { parsedRows },
                  );
                },
              },
            );
          } catch (error) {
            setFirstError(error, {
              fileName: target.fileName,
              tableName: target.tableName,
            });
            return;
          }
        }
      } catch (error) {
        setFirstError(error);
      } finally {
        parseWorker.terminate();
      }
    },
  );
};
