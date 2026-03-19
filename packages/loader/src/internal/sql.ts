import type {SqlBindMap} from "../types.js";

const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const assertIdentifier = (identifier: string): void => {
  if (!SQL_IDENTIFIER_RE.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
};

export const quoteIdentifier = (identifier: string): string => {
  assertIdentifier(identifier);
  return `"${identifier}"`;
};

const assertNonNegativeInteger = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
};

export const buildOrderByClause = (orderBy?: string | readonly string[]): string => {
  if (!orderBy) {
    return "";
  }

  const columns = Array.isArray(orderBy) ? orderBy : [orderBy];
  if (columns.length === 0) {
    return "";
  }

  return ` ORDER BY ${columns.map((column) => quoteIdentifier(column)).join(", ")}`;
};

export const buildSelectClause = (columns?: readonly string[]): string => {
  if (!columns || columns.length === 0) {
    return "SELECT *";
  }

  return `SELECT ${columns.map((column) => quoteIdentifier(column)).join(", ")}`;
};

export const buildLimitOffsetClause = (options: {
  limit?: number;
  offset?: number;
}): { clause: string; bind: SqlBindMap } => {
  const bind: SqlBindMap = {};
  const parts: string[] = [];
  const { limit } = options;
  const offset = options.offset ?? 0;

  assertNonNegativeInteger("offset", offset);

  if (limit !== undefined) {
    assertNonNegativeInteger("limit", limit);
    parts.push("LIMIT :limit");
    bind.limit = limit;
  }

  if (offset > 0) {
    if (limit === undefined) {
      parts.push("LIMIT -1");
    }
    parts.push("OFFSET :offset");
    bind.offset = offset;
  }

  if (parts.length === 0) {
    return { clause: "", bind };
  }

  return { clause: ` ${parts.join(" ")}`, bind };
};

export const normalizeBind = (bind: SqlBindMap): SqlBindMap => {
  const normalized: SqlBindMap = {};
  for (const [key, value] of Object.entries(bind)) {
    if (key.startsWith(":") || key.startsWith("$") || key.startsWith("@")) {
      normalized[key] = value;
      continue;
    }
    normalized[`:${key}`] = value;
  }
  return normalized;
};

export const toSqlLiteral = (value: string | undefined): string => {
  if (value === undefined) {
    return "NULL";
  }

  const normalized = value.replace(/\r$/, "");
  if (normalized === "") {
    return "NULL";
  }

  return `'${normalized.replaceAll("'", "''")}'`;
};

export const toTableNameFromTxtFile = (fileName: string): string | undefined => {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".txt")) {
    return undefined;
  }

  const stem = fileName.slice(0, -4);
  if (!SQL_IDENTIFIER_RE.test(stem)) {
    return undefined;
  }

  return stem;
};
