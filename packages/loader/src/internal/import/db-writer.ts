import { getGtfsJpV4TableSchema, isGtfsJpV4TableName } from '@gtfs-jp/types';

import { quoteIdentifier, toSqlLiteral } from '../sql.js';
import { SqliteSession } from '../session.js';

export type WriteChunkInput = {
  fileName: string;
  tableName: string;
  headers: string[];
  rows: string[][];
  isFirst: boolean;
  isLast: boolean;
};

export type TableWriteState = {
  writeHeaders: string[];
  sourceIndexByWriteHeader: number[];
  sawData: boolean;
  rowsWritten: number;
};

const getColumnSqlType = (tableName: string, columnName: string): 'REAL' | 'TEXT' => {
  if (!isGtfsJpV4TableName(tableName)) {
    return 'TEXT';
  }
  const schema = getGtfsJpV4TableSchema(tableName);
  const column = (
    schema.columns as Record<string, { kind?: string; values?: readonly unknown[] } | undefined>
  )[columnName];
  if (!column) {
    return 'TEXT';
  }
  if (column.kind === 'number') {
    return 'REAL';
  }
  if (column.values && column.values.length > 0 && typeof column.values[0] === 'number') {
    return 'REAL';
  }
  return 'TEXT';
};

const createTable = async (
  session: SqliteSession,
  tableName: string,
  headers: string[],
): Promise<void> => {
  await session.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)};`);
  const columnsSql = headers
    .map((header) => `${quoteIdentifier(header)} ${getColumnSqlType(tableName, header)}`)
    .join(', ');
  await session.exec(`CREATE TABLE ${quoteIdentifier(tableName)} (${columnsSql});`);
};

const resolveWriteHeaders = (tableName: string, sourceHeaders: string[]): string[] => {
  if (!isGtfsJpV4TableName(tableName)) {
    return sourceHeaders;
  }

  const schema = getGtfsJpV4TableSchema(tableName);
  const existing = new Set(sourceHeaders);
  const supplementalHeaders = Object.entries(schema.columns)
    .filter(([, column]) => column.required !== true)
    .map(([columnName]) => columnName)
    .filter((columnName) => !existing.has(columnName));

  return [...sourceHeaders, ...supplementalHeaders];
};

const insertBatch = async (
  session: SqliteSession,
  tableName: string,
  headers: string[],
  sourceIndexByWriteHeader: number[],
  rows: string[][],
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  const quotedHeaders = headers.map(quoteIdentifier).join(', ');
  const valuesSql = rows
    .map((row) => {
      const cells = headers.map((_, index) => {
        const sourceIndex = sourceIndexByWriteHeader[index];
        return toSqlLiteral(sourceIndex >= 0 ? row[sourceIndex] : undefined);
      });
      return `(${cells.join(', ')})`;
    })
    .join(', ');

  await session.exec(
    `INSERT INTO ${quoteIdentifier(tableName)} (${quotedHeaders}) VALUES ${valuesSql};`,
  );
};

export const writeTableChunk = async (
  session: SqliteSession,
  stateByTable: Map<string, TableWriteState>,
  chunk: WriteChunkInput,
  insertBatchRowCount: number,
): Promise<{
  tableCreated: boolean;
  rowsWritten: number;
}> => {
  if (chunk.isFirst && chunk.headers.length > 0) {
    const writeHeaders = resolveWriteHeaders(chunk.tableName, chunk.headers);
    const sourceHeaderIndex = new Map(chunk.headers.map((header, index) => [header, index]));

    await createTable(session, chunk.tableName, writeHeaders);
    stateByTable.set(chunk.tableName, {
      writeHeaders,
      sourceIndexByWriteHeader: writeHeaders.map((header) => sourceHeaderIndex.get(header) ?? -1),
      rowsWritten: 0,
      sawData: false,
    });
  }

  const tableState = stateByTable.get(chunk.tableName);
  if (!tableState) {
    return { tableCreated: false, rowsWritten: 0 };
  }

  for (let index = 0; index < chunk.rows.length; index += insertBatchRowCount) {
    const batch = chunk.rows.slice(index, index + insertBatchRowCount);
    await insertBatch(
      session,
      chunk.tableName,
      tableState.writeHeaders,
      tableState.sourceIndexByWriteHeader,
      batch,
    );
  }

  tableState.rowsWritten += chunk.rows.length;
  if (chunk.rows.length > 0) {
    tableState.sawData = true;
  }

  return {
    tableCreated: chunk.isFirst,
    rowsWritten: chunk.rows.length,
  };
};
