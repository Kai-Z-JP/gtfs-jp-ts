import type { ImportProgressEmitter, ImportTableState } from "../../types.js";

export const emitTableEvent = (
  emit: ImportProgressEmitter,
  phase: "parse" | "write",
  fileName: string,
  tableName: string,
  tableState: ImportTableState,
  message: string,
  extra: Partial<{ parsedRows: number; writtenRows: number; chunkIndex: number; chunkRows: number }> = {},
): void => {
  emit({
    phase,
    fileName,
    tableName,
    tableState,
    message,
    ...extra,
  });
};
