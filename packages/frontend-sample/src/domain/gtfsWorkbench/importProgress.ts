import type { ImportProgressEvent } from "@gtfs-jp/loader";

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
    case "parse":
    case "write": {
      if (!event.fileName || !event.tableState) {
        return {
          ...current,
          phase: event.phase,
        };
      }

      const index = current.tableCards.findIndex((card) => card.fileName === event.fileName);
      if (index === -1) {
        return {
          ...current,
          phase: event.phase,
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
        phase: event.phase,
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
