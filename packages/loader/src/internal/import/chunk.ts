import type { WriteChunkInput } from './db-writer.js';
import type { MaterializationTableMetric } from '../materialization.js';

export type QueuedChunk = WriteChunkInput & {
  chunkIndex: number;
};

export type ImportMetrics = {
  tablesImported: number;
  rowsImported: number;
  sourceTables: MaterializationTableMetric[];
};
