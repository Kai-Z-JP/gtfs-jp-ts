import type { SqliteStorageMode } from "../types.js";

export const resolveFilename = (mode: SqliteStorageMode, fileName?: string): string => {
  if (mode === "memory") {
    return ":memory:";
  }

  if (!fileName) {
    return "file:gtfs-jp-v4.sqlite3?vfs=opfs";
  }

  if (fileName.startsWith("file:")) {
    return fileName;
  }

  return `file:${fileName}?vfs=opfs`;
};

export const getOpfsUnavailableReason = (): string | undefined => {
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

export const toOpfsPath = (filename: string): string => {
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

export const writeBytesToOpfsFile = async (path: string, bytes: Uint8Array): Promise<void> => {
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
