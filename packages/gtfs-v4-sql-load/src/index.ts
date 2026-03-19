import * as sqliteWasmModule from "@sqlite.org/sqlite-wasm";
import JSZip from "jszip";
import Papa from "papaparse";
import {
  GTFS_V4_TABLE_NAMES,
  isGtfsV4TableName,
  type GtfsV4TableName,
  type GtfsV4TableRow,
  type GtfsRow,
} from "@hyperload/gtfs-v4-struct";

export type SqliteStorageMode = "memory" | "opfs";

export interface GtfsV4SqliteLoaderOptions {
  storage?: SqliteStorageMode;
  filename?: string;
  worker?: Worker;
  strictGtfsTableName?: boolean;
}

export interface TableReadOptions {
  limit?: number;
  offset?: number;
  orderBy?: string | readonly string[];
}

export interface LoadGtfsTablesOptions extends TableReadOptions {
  only?: readonly GtfsV4TableName[];
  skipMissing?: boolean;
}

export interface CloseOptions {
  unlink?: boolean;
}

export interface ImportGtfsZipOptions {
  parseConcurrency?: number;
  writeConcurrency?: number;
  opfsImportMode?: "memory-stage" | "direct";
  onStatus?: (message: string) => void;
}

export interface ImportGtfsZipResult {
  tablesImported: number;
  rowsImported: number;
  skippedFiles: string[];
}

type SqlBindValue = string | number | Uint8Array | null;
type SqlBindMap = Record<string, SqlBindValue>;

type SqliteWorkerResponse<T = unknown> = {
  dbId?: string | number;
  result?: T;
};

type ExecResult<T> = {
  resultRows?: T[];
};

type SqlitePromiser = (
  messageType: string,
  payload?: Record<string, unknown>,
) => Promise<SqliteWorkerResponse>;

type Worker1PromiserFactory = (config?: {
  worker?: Worker;
  onready?: () => void;
}) => unknown;

type ImportTarget = {
  entry: JSZip.JSZipObject;
  fileName: string;
  tableName: string;
};

type ParsedTable = {
  fileName: string;
  tableName: string;
  headers: string[];
  dataRows: string[][];
};

type WriteImportResult = {
  tablesImported: number;
  rowsImported: number;
};

type OpfsImportPragmaSnapshot = {
  synchronous: number;
  tempStore: number;
  lockingMode: "normal" | "exclusive";
};

const sqlite3Worker1Promiser = (
  sqliteWasmModule as unknown as {
    sqlite3Worker1Promiser?: Worker1PromiserFactory;
  }
).sqlite3Worker1Promiser;

const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const GTFS_TABLE_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  routes: ["agency", "networks"],
  stops: ["levels"],
  trips: ["routes", "calendar"],
  stop_times: ["trips", "stops", "location_groups", "booking_rules"],
  calendar_dates: ["calendar"],
  fare_attributes: ["agency"],
  fare_rules: ["fare_attributes", "routes", "stops"],
  pathways: ["stops", "levels"],
  location_group_stops: ["location_groups", "stops"],
  stop_areas: ["areas", "stops"],
  route_networks: ["routes", "networks"],
  frequencies: ["trips"],
  transfers: ["stops", "routes", "trips"],
  attributions: ["agency", "routes", "trips", "stops"],
  fare_leg_rules: ["fare_products", "areas", "networks", "timeframes"],
  fare_leg_join_rules: ["fare_leg_rules"],
  fare_transfer_rules: ["fare_leg_rules", "fare_products"],
};

const assertIdentifier = (identifier: string): void => {
  if (!SQL_IDENTIFIER_RE.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
};

const quoteIdentifier = (identifier: string): string => {
  assertIdentifier(identifier);
  return `"${identifier}"`;
};

const buildOrderByClause = (orderBy?: string | readonly string[]): string => {
  if (!orderBy) {
    return "";
  }

  const columns = Array.isArray(orderBy) ? orderBy : [orderBy];
  if (columns.length === 0) {
    return "";
  }

  const rendered = columns.map((column) => quoteIdentifier(column));
  return ` ORDER BY ${rendered.join(", ")}`;
};

const assertNonNegativeInteger = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
};

const buildLimitOffsetClause = (
  options: TableReadOptions,
): { clause: string; bind: SqlBindMap } => {
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

const normalizeBind = (bind: SqlBindMap): SqlBindMap => {
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

const resolveFilename = (mode: SqliteStorageMode, fileName?: string): string => {
  if (mode === "memory") {
    return ":memory:";
  }

  if (!fileName) {
    return "file:gtfs-v4.sqlite3?vfs=opfs";
  }

  if (fileName.startsWith("file:")) {
    return fileName;
  }

  return `file:${fileName}?vfs=opfs`;
};

const getOpfsUnavailableReason = (): string | undefined => {
  const runtime = globalThis as typeof globalThis & {
    crossOriginIsolated?: boolean;
    isSecureContext?: boolean;
    SharedArrayBuffer?: unknown;
    Atomics?: unknown;
    navigator?: Navigator;
  };

  if (runtime.isSecureContext === false) {
    return "requires a secure context (HTTPS or localhost).";
  }

  if (runtime.crossOriginIsolated === false) {
    return "missing COOP/COEP headers (Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy).";
  }

  if (typeof runtime.SharedArrayBuffer === "undefined" || typeof runtime.Atomics === "undefined") {
    return "SharedArrayBuffer and/or Atomics are unavailable.";
  }

  if (typeof runtime.navigator?.storage?.getDirectory !== "function") {
    return "navigator.storage.getDirectory() is not available in this environment.";
  }

  return undefined;
};

const createPromiser = async (worker?: Worker): Promise<SqlitePromiser> =>
  await new Promise<SqlitePromiser>((resolve) => {
    if (!sqlite3Worker1Promiser) {
      throw new Error(
        "sqlite3Worker1Promiser is not available in @sqlite.org/sqlite-wasm",
      );
    }

    let promiser: SqlitePromiser;
    promiser = sqlite3Worker1Promiser({
      worker,
      onready: () => resolve(promiser),
    }) as unknown as SqlitePromiser;
  });

export class GtfsV4SqliteLoader {
  #mode: SqliteStorageMode;
  #filename?: string;
  #worker?: Worker;
  #strictGtfsTableName: boolean;
  #promiser?: SqlitePromiser;
  #dbId?: string | number;

  constructor(options: GtfsV4SqliteLoaderOptions = {}) {
    this.#mode = options.storage ?? "memory";
    this.#filename = options.filename;
    this.#worker = options.worker;
    this.#strictGtfsTableName = options.strictGtfsTableName ?? true;
  }

  get mode(): SqliteStorageMode {
    return this.#mode;
  }

  async open(): Promise<void> {
    if (this.#dbId !== undefined) {
      return;
    }

    if (this.#mode === "opfs") {
      const reason = getOpfsUnavailableReason();
      if (reason) {
        throw new Error(`OPFS mode is unavailable: ${reason}`);
      }
    }

    this.#promiser = await createPromiser(this.#worker);
    const filename = resolveFilename(this.#mode, this.#filename);

    const response = await this.#promiser("open", { filename });
    const dbId =
      response.dbId ??
      (response.result as Record<string, string | number> | undefined)?.dbId;

    if (dbId === undefined) {
      throw new Error("Failed to open sqlite database: dbId not returned");
    }

    this.#dbId = dbId;
  }

  async close(options: CloseOptions = {}): Promise<void> {
    if (!this.#promiser || this.#dbId === undefined) {
      return;
    }

    await this.#promiser("close", {
      dbId: this.#dbId,
      unlink: options.unlink ?? false,
    });

    this.#dbId = undefined;
  }

  async listAllTables(): Promise<string[]> {
    const rows = await this.#execRows<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );

    return rows.map((row) => row.name);
  }

  async listAvailableGtfsTables(): Promise<GtfsV4TableName[]> {
    const names = await this.listAllTables();
    return names.filter(isGtfsV4TableName);
  }

  async hasTable(tableName: string): Promise<boolean> {
    const rows = await this.#execRows<{ found: number }>(
      "SELECT 1 as found FROM sqlite_master WHERE type = 'table' AND name = :name LIMIT 1",
      { name: tableName },
    );

    return rows.length > 0;
  }

  async readTable<TName extends GtfsV4TableName>(
    tableName: TName,
    options: TableReadOptions = {},
  ): Promise<Array<GtfsV4TableRow<TName>>> {
    if (this.#strictGtfsTableName && !isGtfsV4TableName(tableName)) {
      throw new Error(`Unknown GTFS v4 table: ${tableName}`);
    }

    const orderByClause = buildOrderByClause(options.orderBy);
    const { clause: limitOffsetClause, bind } = buildLimitOffsetClause(options);

    const sql = `SELECT * FROM ${quoteIdentifier(tableName)}${orderByClause}${limitOffsetClause}`;

    return await this.#execRows<GtfsV4TableRow<TName>>(sql, bind);
  }

  async readUnknownTable(
    tableName: string,
    options: TableReadOptions = {},
  ): Promise<GtfsRow[]> {
    assertIdentifier(tableName);

    const orderByClause = buildOrderByClause(options.orderBy);
    const { clause: limitOffsetClause, bind } = buildLimitOffsetClause(options);

    const sql = `SELECT * FROM ${quoteIdentifier(tableName)}${orderByClause}${limitOffsetClause}`;

    return await this.#execRows<GtfsRow>(sql, bind);
  }

  async loadGtfsTables(
    options: LoadGtfsTablesOptions = {},
  ): Promise<Partial<Record<GtfsV4TableName, GtfsRow[]>>> {
    const targetTables = options.only ?? GTFS_V4_TABLE_NAMES;
    const existing = new Set(await this.listAllTables());
    const output: Partial<Record<GtfsV4TableName, GtfsRow[]>> = {};

    for (const table of targetTables) {
      if (!existing.has(table)) {
        if (options.skipMissing ?? true) {
          continue;
        }
        throw new Error(`Table does not exist: ${table}`);
      }

      const rows = await this.readTable(table, options);
      output[table] = rows;
    }

    return output;
  }

  async importGtfsZip(
    file: File | Blob | ArrayBuffer | Uint8Array,
    options: ImportGtfsZipOptions = {},
  ): Promise<ImportGtfsZipResult> {
    if (this.#mode === "opfs" && (options.opfsImportMode ?? "memory-stage") === "memory-stage") {
      return await this.#importViaMemoryStage(file, options);
    }

    return await this.#importIntoCurrentDb(file, options);
  }

  async #importIntoCurrentDb(
    file: File | Blob | ArrayBuffer | Uint8Array,
    options: ImportGtfsZipOptions,
  ): Promise<ImportGtfsZipResult> {
    const archive = await JSZip.loadAsync(await toArrayBuffer(file));

    const txtEntries = Object.values(archive.files)
      .filter((entry) => !entry.dir)
      .filter((entry) => entry.name.toLowerCase().endsWith(".txt"));

    if (txtEntries.length === 0) {
      throw new Error("ZIP does not contain .txt files");
    }

    const importTargets: ImportTarget[] = [];
    const skippedFiles: string[] = [];

    for (const entry of txtEntries) {
      const fileName = entry.name.split("/").pop() ?? entry.name;
      const tableName = toTableName(fileName);
      if (!tableName) {
        skippedFiles.push(fileName);
        continue;
      }
      importTargets.push({ entry, fileName, tableName });
    }

    if (importTargets.length === 0) {
      throw new Error("No importable .txt files found in ZIP");
    }

    const parseConcurrency = normalizeConcurrency(options.parseConcurrency, 8);
    const parsedTables = await mapWithConcurrency(importTargets, parseConcurrency, async (target, index) => {
      options.onStatus?.(`ZIP parse (${index + 1}/${importTargets.length}): ${target.fileName}`);
      return await parseGtfsTxt(target);
    });

    const writeLevels = resolveWriteLevels(parsedTables);
    const writeConcurrency =
      options.writeConcurrency === undefined
        ? this.#mode === "opfs"
          ? 1
          : 4
        : normalizeConcurrency(options.writeConcurrency, 4);
    const insertBatchSize = this.#mode === "opfs" ? 1000 : 250;

    let tablesImported = 0;
    let rowsImported = 0;
    let writeProgress = 0;

    await this.#withImportWriteTuning(async () => {
      await this.exec(this.#mode === "opfs" ? "BEGIN IMMEDIATE;" : "BEGIN;");
      try {
        for (let levelIndex = 0; levelIndex < writeLevels.length; levelIndex += 1) {
          const levelTables = writeLevels[levelIndex];
          const settledResults = await mapWithConcurrencySettled(levelTables, writeConcurrency, async (parsedTable) => {
            writeProgress += 1;
            options.onStatus?.(
              `DB write L${levelIndex + 1}/${writeLevels.length} (${writeProgress}/${parsedTables.length}): ${parsedTable.fileName}`,
            );
            return await writeParsedTable(this, parsedTable, skippedFiles, insertBatchSize);
          });

          const failed = settledResults.find((result) => result.status === "rejected");
          if (failed && failed.status === "rejected") {
            throw failed.reason;
          }

          for (const result of settledResults) {
            if (result.status === "fulfilled") {
              tablesImported += result.value.tablesImported;
              rowsImported += result.value.rowsImported;
            }
          }
        }

        await this.exec("COMMIT;");
      } catch (error) {
        await this.exec("ROLLBACK;");
        throw error;
      }
    });

    return {
      tablesImported,
      rowsImported,
      skippedFiles,
    };
  }

  async #importViaMemoryStage(
    file: File | Blob | ArrayBuffer | Uint8Array,
    options: ImportGtfsZipOptions,
  ): Promise<ImportGtfsZipResult> {
    this.#ensureOpen();
    const opfsFilename = resolveFilename(this.#mode, this.#filename);
    const opfsPath = toOpfsPath(opfsFilename);

    options.onStatus?.("OPFS memory-stage: close current DB");
    await this.close();

    const stagingLoader = new GtfsV4SqliteLoader({
      storage: "memory",
      worker: this.#worker,
      strictGtfsTableName: this.#strictGtfsTableName,
    });

    let result: ImportGtfsZipResult | undefined;
    let pendingError: unknown;

    try {
      options.onStatus?.("OPFS memory-stage: open :memory: DB");
      await stagingLoader.open();
      result = await stagingLoader.#importIntoCurrentDb(file, options);
      options.onStatus?.("OPFS memory-stage: export sqlite bytes");
      const bytes = await stagingLoader.#exportCurrentDbBytes();
      options.onStatus?.(`OPFS memory-stage: write sqlite file (${opfsPath})`);
      await writeBytesToOpfsFile(opfsPath, bytes);
    } catch (error) {
      pendingError = error;
    } finally {
      try {
        await stagingLoader.close();
      } catch (error) {
        pendingError ??= error;
      }

      try {
        options.onStatus?.("OPFS memory-stage: reopen OPFS DB");
        await this.open();
      } catch (error) {
        pendingError ??= error;
      }
    }

    if (pendingError) {
      throw pendingError;
    }

    if (!result) {
      throw new Error("OPFS memory-stage import completed without a result");
    }

    return result;
  }

  async exec(sql: string, bind: Record<string, SqlBindValue> = {}): Promise<void> {
    this.#ensureOpen();
    await this.#promiser!("exec", {
      dbId: this.#dbId,
      sql,
      bind: normalizeBind(bind),
    });
  }

  #ensureOpen(): void {
    if (!this.#promiser || this.#dbId === undefined) {
      throw new Error("SQLite database is not opened. Call open() first.");
    }
  }

  async #execRows<T extends GtfsRow>(
    sql: string,
    bind: Record<string, SqlBindValue> = {},
  ): Promise<T[]> {
    this.#ensureOpen();

    const response = await this.#promiser!("exec", {
      dbId: this.#dbId,
      sql,
      bind: normalizeBind(bind),
      rowMode: "object",
      resultRows: [],
    });

    const result = response.result as ExecResult<T> | undefined;
    return result?.resultRows ?? [];
  }

  async #withImportWriteTuning<T>(runner: () => Promise<T>): Promise<T> {
    if (this.#mode !== "opfs") {
      return await runner();
    }

    const snapshot = await this.#captureOpfsImportPragmas();
    await this.exec("PRAGMA synchronous = NORMAL;");
    await this.exec("PRAGMA temp_store = MEMORY;");
    await this.exec("PRAGMA locking_mode = EXCLUSIVE;");

    try {
      return await runner();
    } finally {
      await this.exec(`PRAGMA locking_mode = ${snapshot.lockingMode.toUpperCase()};`);
      await this.exec(`PRAGMA temp_store = ${snapshot.tempStore};`);
      await this.exec(`PRAGMA synchronous = ${snapshot.synchronous};`);
    }
  }

  async #captureOpfsImportPragmas(): Promise<OpfsImportPragmaSnapshot> {
    const [synchronous, tempStore, lockingMode] = await Promise.all([
      this.#readNumericPragma("synchronous"),
      this.#readNumericPragma("temp_store"),
      this.#readTextPragma("locking_mode"),
    ]);

    return {
      synchronous: toSafePragmaInt(synchronous, 0, 3, 2),
      tempStore: toSafePragmaInt(tempStore, 0, 2, 0),
      lockingMode: lockingMode.trim().toLowerCase() === "exclusive" ? "exclusive" : "normal",
    };
  }

  async #readNumericPragma(name: string): Promise<number> {
    const value = await this.#readPragmaValue(name);
    const numeric = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(numeric)) {
      throw new Error(`PRAGMA ${name} returned a non-numeric value: ${String(value)}`);
    }

    return numeric;
  }

  async #readTextPragma(name: string): Promise<string> {
    const value = await this.#readPragmaValue(name);
    return String(value);
  }

  async #readPragmaValue(name: string): Promise<string | number> {
    const rows = await this.#execRows<GtfsRow>(`PRAGMA ${name};`);
    const row = rows[0];

    if (!row) {
      throw new Error(`PRAGMA ${name} returned no rows`);
    }

    const value = Object.values(row)[0];
    if (value === null || value === undefined) {
      throw new Error(`PRAGMA ${name} returned an empty value`);
    }

    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(`PRAGMA ${name} returned unsupported value type`);
    }

    return value;
  }

  async #exportCurrentDbBytes(): Promise<Uint8Array> {
    this.#ensureOpen();

    const response = await this.#promiser!("export", {
      dbId: this.#dbId,
    });
    const result = response.result as { byteArray?: unknown } | undefined;
    const byteArray = result?.byteArray;

    if (byteArray instanceof Uint8Array) {
      return byteArray;
    }

    if (byteArray instanceof ArrayBuffer) {
      return new Uint8Array(byteArray);
    }

    if (ArrayBuffer.isView(byteArray)) {
      return new Uint8Array(byteArray.buffer.slice(byteArray.byteOffset, byteArray.byteOffset + byteArray.byteLength));
    }

    throw new Error("Worker export did not return a valid byte array");
  }
}

export const createGtfsV4SqliteLoader = async (
  options: GtfsV4SqliteLoaderOptions = {},
): Promise<GtfsV4SqliteLoader> => {
  const loader = new GtfsV4SqliteLoader(options);
  await loader.open();
  return loader;
};

const toArrayBuffer = async (value: File | Blob | ArrayBuffer | Uint8Array): Promise<ArrayBuffer> => {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (value instanceof Uint8Array) {
    const copied = new Uint8Array(value.byteLength);
    copied.set(value);
    return copied.buffer;
  }

  return await value.arrayBuffer();
};

const normalizeConcurrency = (value: number | undefined, maxValue: number): number => {
  if (value !== undefined) {
    return Math.max(1, Math.min(maxValue, Math.floor(value)));
  }

  const detected = globalThis.navigator?.hardwareConcurrency ?? 4;
  return Math.max(1, Math.min(maxValue, detected));
};

const toOpfsPath = (filename: string): string => {
  if (!filename.startsWith("file:")) {
    throw new Error(`OPFS filename must start with file: ${filename}`);
  }

  const withoutScheme = filename.slice(5);
  const pathPart = withoutScheme.split("?")[0] ?? "";
  if (!pathPart) {
    throw new Error(`OPFS filename has no path: ${filename}`);
  }

  return decodeURIComponent(pathPart);
};

const writeBytesToOpfsFile = async (path: string, bytes: Uint8Array): Promise<void> => {
  if (typeof globalThis.navigator?.storage?.getDirectory !== "function") {
    throw new Error("navigator.storage.getDirectory() is not available in this environment.");
  }

  const normalizedParts = path.split("/").filter((part) => part.length > 0);
  if (normalizedParts.length === 0) {
    throw new Error(`Invalid OPFS path: ${path}`);
  }

  let directory = await globalThis.navigator.storage.getDirectory();
  for (let index = 0; index < normalizedParts.length - 1; index += 1) {
    directory = await directory.getDirectoryHandle(normalizedParts[index], { create: true });
  }

  const fileName = normalizedParts[normalizedParts.length - 1];
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  let writeFailed = false;
  try {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    await writable.write(buffer);
  } catch (error) {
    writeFailed = true;
    try {
      await writable.abort();
    } catch {
      // no-op: abort failures should not hide the original write error.
    }
    throw error;
  } finally {
    if (!writeFailed) {
      await writable.close();
    }
  }
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

const parseGtfsTxt = async (target: ImportTarget): Promise<ParsedTable> => {
  const csv = await target.entry.async("text");
  const parsed = Papa.parse<string[]>(csv, {
    header: false,
    skipEmptyLines: "greedy",
  });

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0];
    throw new Error(`${target.fileName}: CSV parse error at row ${firstError.row}: ${firstError.message}`);
  }

  const records = parsed.data;
  if (records.length === 0) {
    return {
      fileName: target.fileName,
      tableName: target.tableName,
      headers: [],
      dataRows: [],
    };
  }

  const headers = records[0].map((value, index) => normalizeHeaderName(value, target.fileName, index));
  if (new Set(headers).size !== headers.length) {
    throw new Error(`${target.fileName}: duplicate columns found`);
  }

  return {
    fileName: target.fileName,
    tableName: target.tableName,
    headers,
    dataRows: records.slice(1).filter(hasNonEmptyCell),
  };
};

const writeParsedTable = async (
  loader: GtfsV4SqliteLoader,
  parsedTable: ParsedTable,
  skippedFiles: string[],
  batchSize: number,
): Promise<WriteImportResult> => {
  if (parsedTable.headers.length === 0) {
    skippedFiles.push(`${parsedTable.fileName} (empty)`);
    return {
      tablesImported: 0,
      rowsImported: 0,
    };
  }

  await loader.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(parsedTable.tableName)};`);
  const createColumns = parsedTable.headers.map((column) => `${quoteIdentifier(column)} TEXT`).join(", ");
  await loader.exec(`CREATE TABLE ${quoteIdentifier(parsedTable.tableName)} (${createColumns});`);

  const dataRows = parsedTable.dataRows;
  if (dataRows.length === 0) {
    skippedFiles.push(`${parsedTable.fileName} (empty)`);
    return {
      tablesImported: 1,
      rowsImported: 0,
    };
  }

  const quotedHeaders = parsedTable.headers.map(quoteIdentifier).join(", ");
  for (let batchIndex = 0; batchIndex < dataRows.length; batchIndex += batchSize) {
    const batch = dataRows.slice(batchIndex, batchIndex + batchSize);
    const valuesSql = batch
      .map((row) => {
        const cells = parsedTable.headers.map((_, headerIndex) => toSqlLiteral(row[headerIndex]));
        return `(${cells.join(", ")})`;
      })
      .join(", ");

    await loader.exec(`INSERT INTO ${quoteIdentifier(parsedTable.tableName)} (${quotedHeaders}) VALUES ${valuesSql};`);
  }

  return {
    tablesImported: 1,
    rowsImported: dataRows.length,
  };
};

const resolveWriteLevels = (parsedTables: ParsedTable[]): ParsedTable[][] => {
  if (parsedTables.length === 0) {
    return [];
  }

  const duplicates = new Set<string>();
  const seen = new Set<string>();
  for (const parsedTable of parsedTables) {
    if (seen.has(parsedTable.tableName)) {
      duplicates.add(parsedTable.tableName);
      continue;
    }
    seen.add(parsedTable.tableName);
  }
  if (duplicates.size > 0) {
    return parsedTables.map((parsedTable) => [parsedTable]);
  }

  const byName = new Map(parsedTables.map((parsedTable) => [parsedTable.tableName, parsedTable]));
  const allNames = new Set(parsedTables.map((parsedTable) => parsedTable.tableName));
  const remaining = new Set(allNames);
  const blockedBy = new Map<string, Set<string>>();
  for (const tableName of allNames) {
    blockedBy.set(tableName, new Set(getDependencyTableNames(tableName, allNames)));
  }

  const levels: ParsedTable[][] = [];
  while (remaining.size > 0) {
    const readyNames = parsedTables
      .map((parsedTable) => parsedTable.tableName)
      .filter((tableName) => remaining.has(tableName))
      .filter((tableName) => (blockedBy.get(tableName)?.size ?? 0) === 0);

    if (readyNames.length === 0) {
      const fallback = parsedTables.find((parsedTable) => remaining.has(parsedTable.tableName));
      if (!fallback) {
        break;
      }
      readyNames.push(fallback.tableName);
    }

    const level: ParsedTable[] = [];
    for (const readyName of readyNames) {
      const parsedTable = byName.get(readyName);
      if (!parsedTable) {
        continue;
      }
      level.push(parsedTable);
      remaining.delete(readyName);
    }
    if (level.length > 0) {
      levels.push(level);
    }

    for (const dependencySet of blockedBy.values()) {
      for (const readyName of readyNames) {
        dependencySet.delete(readyName);
      }
    }
  }

  return levels;
};

const getDependencyTableNames = (tableName: string, availableTableNames: ReadonlySet<string>): string[] => {
  if (tableName === "translations") {
    return Array.from(availableTableNames).filter((name) => name !== tableName);
  }

  const dependencies = GTFS_TABLE_DEPENDENCIES[tableName] ?? [];
  return dependencies.filter((dependency) => availableTableNames.has(dependency));
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
};

const mapWithConcurrencySettled = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> => {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = {
          status: "fulfilled",
          value: await mapper(items[index], index),
        };
      } catch (reason) {
        results[index] = {
          status: "rejected",
          reason,
        };
      }
    }
  });

  await Promise.all(workers);
  return results;
};

const toTableName = (fileName: string): string | undefined => {
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

const normalizeHeaderName = (header: string, fileName: string, index: number): string => {
  const cleaned = header.replace(/^\uFEFF/, "").trim();
  if (!cleaned) {
    throw new Error(`${fileName}: header[${index}] is empty`);
  }

  if (!SQL_IDENTIFIER_RE.test(cleaned)) {
    throw new Error(`${fileName}: header[${index}] is not a valid SQL identifier: ${cleaned}`);
  }

  return cleaned;
};

const hasNonEmptyCell = (row: string[]): boolean =>
  row.some((value) => value !== undefined && value.trim() !== "");

const toSqlLiteral = (value: string | undefined): string => {
  if (value === undefined) {
    return "NULL";
  }

  const normalized = value.replace(/\r$/, "");
  if (normalized === "") {
    return "NULL";
  }

  return `'${normalized.replaceAll("'", "''")}'`;
};
