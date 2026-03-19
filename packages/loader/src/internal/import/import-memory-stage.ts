import type {
  ImportGtfsZipOptions,
  ImportGtfsZipResult,
  ImportProgressEmitter,
} from "../../types.js";
import { SqliteSession } from "../session.js";
import { resolveFilename, toOpfsPath, writeBytesToOpfsFile } from "../storage.js";
import { importZipIntoSession } from "./import-pipeline.js";

type ImportViaMemoryStageArgs = {
  session: SqliteSession;
  strictGtfsTableName: boolean;
  file: File | Blob | ArrayBuffer | Uint8Array;
  options: ImportGtfsZipOptions;
  emit: ImportProgressEmitter;
};

export const importZipViaMemoryStage = async ({
  session,
  strictGtfsTableName,
  file,
  options,
  emit,
}: ImportViaMemoryStageArgs): Promise<ImportGtfsZipResult> => {
  const opfsFilename = resolveFilename(session.mode, session.filename);
  const opfsPath = toOpfsPath(opfsFilename);

  emit({
    phase: "opfs-stage",
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
      phase: "opfs-stage",
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
    });

    emit({
      phase: "opfs-stage",
      message: "OPFS memory-stage: export sqlite bytes",
    });
    const bytes = await stagingSession.exportBytes();

    emit({
      phase: "opfs-stage",
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
        phase: "opfs-stage",
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
