import type { ImportTableState } from "@hyperload/gtfs-jp-v4-sql-load";

export function stateBadgeClassName(state: ImportTableState): string {
  switch (state) {
    case "queued":
      return "border-neutral-500 text-neutral-600";
    case "parsing":
      return "border-blue-600 text-blue-700";
    case "parsed":
      return "border-cyan-600 text-cyan-700";
    case "writing":
      return "border-amber-600 text-amber-700";
    case "done":
      return "border-green-700 text-green-800";
    case "skipped":
      return "border-neutral-600 text-neutral-700";
    case "error":
      return "border-red-700 text-red-800";
    default:
      return "border-neutral-500 text-neutral-700";
  }
}
