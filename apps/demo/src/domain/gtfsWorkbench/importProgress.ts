import type {ImportProgressEvent} from "@gtfs-jp/loader";

import type {ImportProgressState} from "./types";

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
        name: target.targetName,
        state: "queued" as const,
      }));
      return {
        ...current,
        phase: "prepare",
        tableCards: nextCards,
      };
    }
    case "import":
    case "derive": {
      if (!event.targetName || !event.state) {
        return {
          ...current,
          phase: event.phase,
        };
      }

      const index = current.tableCards.findIndex((card) => card.name === event.targetName);
      if (index === -1) {
        return {
          ...current,
          phase: event.phase,
          tableCards: [
            ...current.tableCards,
            {
              name: event.targetName,
              state: event.state,
            },
          ],
        };
      }

      const nextCards = [...current.tableCards];
      nextCards[index] = {
        ...nextCards[index],
        state: event.state,
      };
      return {
        ...current,
        phase: event.phase,
        tableCards: nextCards,
      };
    }
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
