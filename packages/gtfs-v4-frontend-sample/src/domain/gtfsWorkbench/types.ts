import type { ImportProgressPhase, ImportTableState } from "@hyperload/gtfs-v4-sql-load";

export type StatusType = "ok" | "warn" | "error";

export type StatusMessage = {
  type: StatusType;
  message: string;
};

export type OpfsSupport = {
  available: boolean;
  reason?: string;
};

export type ImportProgressViewPhase = "idle" | ImportProgressPhase;

export type TableProgressCard = {
  fileName: string;
  state: ImportTableState;
};

export type ImportProgressState = {
  phase: ImportProgressViewPhase;
  tableCards: TableProgressCard[];
};
