import JSZip from "jszip";
import { resolveGtfsJpV4TableNameFromFileName } from "@gtfs-jp/types";

import { toTableNameFromTxtFile } from "../sql.js";

export type ImportTarget = {
  index: number;
  entry: JSZip.JSZipObject;
  fileName: string;
  tableName: string;
};

export const collectImportTargets = (options: {
  archive: JSZip;
  strictGtfsTableName: boolean;
}): {
  targets: ImportTarget[];
  skippedFiles: string[];
} => {
  const txtEntries = Object.values(options.archive.files)
    .filter((entry) => !entry.dir)
    .filter((entry) => entry.name.toLowerCase().endsWith(".txt"));

  if (txtEntries.length === 0) {
    throw new Error("ZIP does not contain .txt files");
  }

  const targets: ImportTarget[] = [];
  const skippedFiles: string[] = [];

  for (const entry of txtEntries) {
    const fileName = entry.name.split("/").pop() ?? entry.name;
    const strictTableName = resolveGtfsJpV4TableNameFromFileName(fileName);
    const fallbackTableName = options.strictGtfsTableName ? undefined : toTableNameFromTxtFile(fileName);
    const tableName = strictTableName ?? fallbackTableName;

    if (!tableName) {
      skippedFiles.push(fileName);
      continue;
    }

    targets.push({
      index: targets.length,
      entry,
      fileName,
      tableName,
    });
  }

  if (targets.length === 0) {
    throw new Error("No importable .txt files found in ZIP");
  }

  return {
    targets,
    skippedFiles,
  };
};
