import type { ImportProgressEmitter, ImportTargetState } from '../../types.js';

export const emitSourceEvent = (
  emit: ImportProgressEmitter,
  tableName: string,
  state: ImportTargetState,
  message: string,
  rowsWritten?: number,
): void => {
  emit({
    phase: 'import',
    targetKind: 'source',
    targetName: tableName,
    state,
    message,
    rowsWritten,
  });
};
