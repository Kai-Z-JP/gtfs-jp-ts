import type { ImportProgressPhase, ImportTargetState } from '@gtfs-jp/loader';

export type StatusType = 'ok' | 'warn' | 'error';

export type StatusMessage = {
  type: StatusType;
  message: string;
};

export type OpfsSupport = {
  available: boolean;
  reason?: string;
};

export type ImportProgressViewPhase = 'idle' | ImportProgressPhase;

export type TableProgressCard = {
  name: string;
  state: ImportTargetState;
};

export type ImportProgressState = {
  phase: ImportProgressViewPhase;
  tableCards: TableProgressCard[];
};

export type WhereOperator =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'LIKE'
  | 'NOT LIKE'
  | 'IS NULL'
  | 'IS NOT NULL';

export type WhereCondition = {
  column: string;
  operator: WhereOperator;
  value: string;
};
