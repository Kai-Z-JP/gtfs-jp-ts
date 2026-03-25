import type { ImportProgressPhase, ImportTargetState } from '@gtfs-jp/loader';
import type { ComparisonOperator } from 'kysely';

export const GTFS_WHERE_OPERATORS = [
  '=',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  'like',
  'not like',
  'in',
  'not in',
  'is',
  'is not',
] as const satisfies readonly ComparisonOperator[];

export type GtfsWhereOperator = (typeof GTFS_WHERE_OPERATORS)[number];

export type WhereCondition = {
  column: string;
  operator: GtfsWhereOperator;
  value: string;
};

export const ORDER_DIRECTIONS = ['asc', 'desc'] as const;
export type OrderDirection = (typeof ORDER_DIRECTIONS)[number];

export type OrderCondition = {
  column: string;
  direction: OrderDirection;
};

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
