import type { WriteChunkInput } from "./db-writer.js";

export type QueuedChunk = WriteChunkInput & {
  chunkIndex: number;
};

export type ImportMetrics = {
  tablesImported: number;
  rowsImported: number;
};
