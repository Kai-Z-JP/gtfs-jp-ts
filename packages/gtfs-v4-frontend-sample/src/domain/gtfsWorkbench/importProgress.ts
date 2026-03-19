import type { ImportProgressEvent } from "@hyperload/gtfs-v4-sql-load";

import type { ImportProgressState } from "./types";

export function createInitialImportProgress(): ImportProgressState {
  return {
    phase: "idle",
    tableCards: [],
  };
}

export function reduceImportProgressState(
  current: ImportProgressState,
  event: ImportProgressEvent,
): ImportProgressState {
  switch (event.phase) {
    case "prepare": {
      const nextCards = (event.targets ?? []).map((target) => ({
        fileName: target.fileName,
        state: "queued" as const,
      }));
      return {
        ...current,
        phase: "prepare",
        tableCards: nextCards,
      };
    }
    case "table-update": {
      if (!event.fileName || !event.tableState) {
        return {
          ...current,
          phase: "table-update",
        };
      }

      const index = current.tableCards.findIndex((card) => card.fileName === event.fileName);
      if (index === -1) {
        return {
          ...current,
          phase: "table-update",
          tableCards: [
            ...current.tableCards,
            {
              fileName: event.fileName,
              state: event.tableState,
            },
          ],
        };
      }

      const nextCards = [...current.tableCards];
      nextCards[index] = {
        ...nextCards[index],
        state: event.tableState,
      };
      return {
        ...current,
        phase: "table-update",
        tableCards: nextCards,
      };
    }
    case "opfs-stage":
      return {
        ...current,
        phase: "opfs-stage",
      };
    case "done":
      return {
        ...current,
        phase: "done",
      };
    case "error":
      return {
        ...current,
        phase: "error",
      };
    default:
      return current;
  }
}
