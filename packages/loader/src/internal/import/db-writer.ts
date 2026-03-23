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
  headers: string[];
  sawData: boolean;
  rowsWritten: number;
};

const createTable = async (
  session: SqliteSession,
  tableName: string,
  headers: string[],
): Promise<void> => {
  await session.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)};`);
  const columnsSql = headers.map((header) => `${quoteIdentifier(header)} TEXT`).join(', ');
  await session.exec(`CREATE TABLE ${quoteIdentifier(tableName)} (${columnsSql});`);
};

const insertBatch = async (
  session: SqliteSession,
  tableName: string,
  headers: string[],
  rows: string[][],
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  const quotedHeaders = headers.map(quoteIdentifier).join(', ');
  const valuesSql = rows
    .map((row) => {
      const cells = headers.map((_, index) => toSqlLiteral(row[index]));
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
    await createTable(session, chunk.tableName, chunk.headers);
    stateByTable.set(chunk.tableName, {
      headers: chunk.headers,
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
    await insertBatch(session, chunk.tableName, tableState.headers, batch);
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
