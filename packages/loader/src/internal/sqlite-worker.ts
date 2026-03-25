import * as sqliteWasmModule from '@sqlite.org/sqlite-wasm';

import { getErrorMessage, toError } from './error.js';

export type SqliteWorkerResponse<T = unknown> = {
  dbId?: string | number;
  result?: T;
};

export type SqlitePromiser = (
  messageType: string,
  payload?: Record<string, unknown>,
) => Promise<SqliteWorkerResponse>;

type Worker1PromiserFactory = (config?: {
  worker?: Worker;
  onready?: () => void;
  onerror?: (...args: unknown[]) => void;
}) => unknown;

const sqlite3Worker1Promiser = (
  sqliteWasmModule as unknown as {
    sqlite3Worker1Promiser?: Worker1PromiserFactory;
  }
).sqlite3Worker1Promiser;

const VITE_PLUGIN_IMPORT = '@gtfs-jp/loader/vite';

const isLikelySqliteAssetIssue = (message: string): boolean => {
  const lowerCaseMessage = message.toLowerCase();

  return (
    lowerCaseMessage.includes('sqlite3.wasm') ||
    lowerCaseMessage.includes('sqlite3-opfs-async-proxy.js') ||
    lowerCaseMessage.includes('application/wasm') ||
    lowerCaseMessage.includes('unsupported mime type') ||
    lowerCaseMessage.includes('text/html') ||
    lowerCaseMessage.includes('404')
  );
};

const withSqliteAssetGuidance = (error: unknown): Error => {
  const normalizedError = toError(error);

  if (!isLikelySqliteAssetIssue(normalizedError.message)) {
    return normalizedError;
  }

  return new Error(
    [
      normalizedError.message,
      `SQLite WASM assets were likely served from the wrong path or rewritten to HTML.`,
      `If you are using Vite, add gtfsLoaderPlugin() from "${VITE_PLUGIN_IMPORT}" so sqlite3.wasm and sqlite3-opfs-async-proxy.js are emitted to stable asset paths.`,
    ].join(' '),
  );
};

export const createPromiser = async (worker?: Worker): Promise<SqlitePromiser> => {
  try {
    const promiser = await new Promise<SqlitePromiser>((resolve, reject) => {
      if (!sqlite3Worker1Promiser) {
        reject(new Error('sqlite3Worker1Promiser is not available in @sqlite.org/sqlite-wasm'));
        return;
      }

      let promiserFactory: SqlitePromiser;
      // eslint-disable-next-line prefer-const
      promiserFactory = sqlite3Worker1Promiser({
        worker,
        onready: () => resolve(promiserFactory),
        onerror: (...args) => {
          reject(new Error(args.map((value) => getErrorMessage(value)).join(' ')));
        },
      }) as unknown as SqlitePromiser;
    });

    return async (messageType, payload) => {
      try {
        return await promiser(messageType, payload);
      } catch (error) {
        throw withSqliteAssetGuidance(error);
      }
    };
  } catch (error) {
    throw withSqliteAssetGuidance(error);
  }
};
