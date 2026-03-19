import {getGtfsJpV4TableSchema, type GtfsJpV4TableName, type GtfsRow} from "@gtfs-jp/types";

import {buildLimitOffsetClause, buildOrderByClause, buildSelectClause, quoteIdentifier} from "./sql.js";
import {SqliteSession} from "./session.js";

const shouldCoerceToNumber = (
  tableName: GtfsJpV4TableName,
  columnName: string,
): boolean => {
  const schema = getGtfsJpV4TableSchema(tableName);
  const columns = schema.columns as Record<
    string,
    {
      kind?: "string" | "number";
      values?: readonly (string | number)[];
    }
  >;
  const column = columns[columnName];
  if (!column) {
    return false;
  }

  if (column.kind === "number") {
    return true;
  }

  if (!column.values || column.values.length === 0) {
    return false;
  }

  return typeof column.values[0] === "number";
};

const coerceRow = (tableName: GtfsJpV4TableName, row: GtfsRow): GtfsRow => {
  const nextRow: GtfsRow = {};

  for (const [columnName, value] of Object.entries(row)) {
    if (value === null || value === undefined || !shouldCoerceToNumber(tableName, columnName)) {
      nextRow[columnName] = value;
      continue;
    }

    if (typeof value === "number") {
      nextRow[columnName] = value;
      continue;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`Failed to coerce ${tableName}.${columnName} to number: ${String(value)}`);
    }

    nextRow[columnName] = numericValue;
  }

  return nextRow;
};

export const readTypedGtfsSourceRows = async (
  session: SqliteSession,
  tableName: GtfsJpV4TableName,
  options: {
    limit?: number;
    orderBy?: string | readonly string[];
    columns?: readonly string[];
  } = {},
): Promise<GtfsRow[]> => {
  const selectClause = buildSelectClause(options.columns);
  const orderByClause = buildOrderByClause(options.orderBy);
  const {clause: limitOffsetClause, bind} = buildLimitOffsetClause(options);

  const rows = await session.execRows<GtfsRow>(
    `${selectClause} FROM ${quoteIdentifier(tableName)}${orderByClause}${limitOffsetClause}`,
    bind,
  );

  return rows.map((row) => coerceRow(tableName, row));
};
