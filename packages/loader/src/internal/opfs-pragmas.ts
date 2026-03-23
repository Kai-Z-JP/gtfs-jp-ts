import type { GtfsRow } from '@gtfs-jp/types';

import { SqliteSession } from './session.js';

type OpfsImportPragmaSnapshot = {
  synchronous: number;
  tempStore: number;
  lockingMode: 'normal' | 'exclusive';
};

const toSafePragmaInt = (
  value: number,
  minValue: number,
  maxValue: number,
  fallback: number,
): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value);
  if (normalized < minValue || normalized > maxValue) {
    return fallback;
  }

  return normalized;
};

const readPragmaValue = async (session: SqliteSession, name: string): Promise<string | number> => {
  const rows = await session.execRows<GtfsRow>(`PRAGMA ${name};`);
  const row = rows[0];

  if (!row) {
    throw new Error(`PRAGMA ${name} returned no rows`);
  }

  const value = Object.values(row)[0];
  if (value === null || value === undefined) {
    throw new Error(`PRAGMA ${name} returned an empty value`);
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`PRAGMA ${name} returned unsupported value type`);
  }

  return value;
};

const readNumericPragma = async (session: SqliteSession, name: string): Promise<number> => {
  const value = await readPragmaValue(session, name);
  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    throw new Error(`PRAGMA ${name} returned a non-numeric value: ${String(value)}`);
  }

  return numeric;
};

const readTextPragma = async (session: SqliteSession, name: string): Promise<string> => {
  return String(await readPragmaValue(session, name));
};

const captureSnapshot = async (session: SqliteSession): Promise<OpfsImportPragmaSnapshot> => {
  const [synchronous, tempStore, lockingMode] = await Promise.all([
    readNumericPragma(session, 'synchronous'),
    readNumericPragma(session, 'temp_store'),
    readTextPragma(session, 'locking_mode'),
  ]);

  return {
    synchronous: toSafePragmaInt(synchronous, 0, 3, 2),
    tempStore: toSafePragmaInt(tempStore, 0, 2, 0),
    lockingMode: lockingMode.trim().toLowerCase() === 'exclusive' ? 'exclusive' : 'normal',
  };
};

export const withOpfsImportWriteTuning = async <T>(
  session: SqliteSession,
  runner: () => Promise<T>,
): Promise<T> => {
  const snapshot = await captureSnapshot(session);
  await session.exec('PRAGMA synchronous = NORMAL;');
  await session.exec('PRAGMA temp_store = MEMORY;');
  await session.exec('PRAGMA locking_mode = EXCLUSIVE;');

  try {
    return await runner();
  } finally {
    await session.exec(`PRAGMA locking_mode = ${snapshot.lockingMode.toUpperCase()};`);
    await session.exec(`PRAGMA temp_store = ${snapshot.tempStore};`);
    await session.exec(`PRAGMA synchronous = ${snapshot.synchronous};`);
  }
};
