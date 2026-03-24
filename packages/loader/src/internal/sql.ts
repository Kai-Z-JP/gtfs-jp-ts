import type { SqlBindMap } from '../sql-types.js';

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

export const normalizeBind = (bind: SqlBindMap): SqlBindMap => {
  const normalized: SqlBindMap = {};
  for (const [key, value] of Object.entries(bind)) {
    if (key.startsWith(':') || key.startsWith('$') || key.startsWith('@')) {
      normalized[key] = value;
      continue;
    }
    normalized[`:${key}`] = value;
  }
  return normalized;
};

export const toSqlLiteral = (value: string | undefined): string => {
  if (value === undefined) {
    return 'NULL';
  }

  const normalized = value.replace(/\r$/, '');
  if (normalized === '') {
    return 'NULL';
  }

  return `'${normalized.replaceAll("'", "''")}'`;
};

export const toTableNameFromTxtFile = (fileName: string): string | undefined => {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.txt')) {
    return undefined;
  }

  const stem = fileName.slice(0, -4);
  if (!SQL_IDENTIFIER_RE.test(stem)) {
    return undefined;
  }

  return stem;
};
