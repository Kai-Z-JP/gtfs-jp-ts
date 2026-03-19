import * as sqliteWasmModule from "@sqlite.org/sqlite-wasm";

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
}) => unknown;

const sqlite3Worker1Promiser = (
  sqliteWasmModule as unknown as {
    sqlite3Worker1Promiser?: Worker1PromiserFactory;
  }
).sqlite3Worker1Promiser;

export const createPromiser = async (worker?: Worker): Promise<SqlitePromiser> =>
  await new Promise<SqlitePromiser>((resolve) => {
    if (!sqlite3Worker1Promiser) {
      throw new Error("sqlite3Worker1Promiser is not available in @sqlite.org/sqlite-wasm");
    }

    let promiser: SqlitePromiser;
    promiser = sqlite3Worker1Promiser({
      worker,
      onready: () => resolve(promiser),
    }) as unknown as SqlitePromiser;
  });
