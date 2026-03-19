import type {
  ImportGtfsZipOptions,
  ImportGtfsZipResult,
  ImportProgressEmitter,
} from "../../types.js";
import type { DerivedMaterializationResult } from "../materialization.js";
import { SqliteSession } from "../session.js";
import { resolveFilename, toOpfsPath, writeBytesToOpfsFile } from "../storage.js";
import { importZipIntoSession } from "./import-pipeline.js";

type ImportViaMemoryStageArgs = {
  session: SqliteSession;
  strictGtfsTableName: boolean;
  file: File | Blob | ArrayBuffer | Uint8Array;
  options: ImportGtfsZipOptions;
  emit: ImportProgressEmitter;
  derivedTargetNames?: readonly string[];
  afterImport?: (context: {
    session: SqliteSession;
    emit: ImportProgressEmitter;
    metrics: {
      tablesImported: number;
      rowsImported: number;
      sourceTables: readonly {
        targetKind: "source" | "derived";
        tableName: string;
        state: "queued" | "running" | "done" | "skipped" | "error";
        rowsWritten: number;
        error?: string;
        skipReason?: string;
      }[];
    };
  }) => Promise<DerivedMaterializationResult>;
};

export const importZipViaMemoryStage = async ({
  session,
  strictGtfsTableName,
  file,
  options,
  emit,
  derivedTargetNames,
  afterImport,
}: ImportViaMemoryStageArgs): Promise<ImportGtfsZipResult> => {
  const opfsFilename = resolveFilename(session.mode, session.filename);
  const opfsPath = toOpfsPath(opfsFilename);

  emit({
    phase: "import",
    message: "OPFS memory-stage: close current DB",
  });
  await session.close();

  const stagingSession = new SqliteSession({
    mode: "memory",
    worker: session.worker,
  });

  let result: ImportGtfsZipResult | undefined;
  let pendingError: unknown;

  try {
    emit({
      phase: "import",
      message: "OPFS memory-stage: open :memory: DB",
    });

    await stagingSession.open();
    result = await importZipIntoSession({
      session: stagingSession,
      mode: "memory",
      strictGtfsTableName,
      file,
      options,
      emit,
      derivedTargetNames,
      afterImport,
    });

    emit({
      phase: "import",
      message: "OPFS memory-stage: export sqlite bytes",
    });
    const bytes = await stagingSession.exportBytes();

    emit({
      phase: "import",
      message: `OPFS memory-stage: write sqlite file (${opfsPath})`,
    });
    await writeBytesToOpfsFile(opfsPath, bytes);
  } catch (error) {
    pendingError = error;
  } finally {
    try {
      await stagingSession.close();
    } catch (error) {
      pendingError ??= error;
    }

    try {
      emit({
        phase: "import",
        message: "OPFS memory-stage: reopen OPFS DB",
      });
      await session.open();
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
};
