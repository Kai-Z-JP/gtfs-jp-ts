import type {ImportTargetState} from "@gtfs-jp/loader";

export function stateBadgeClassName(state: ImportTargetState): string {
  switch (state) {
    case "queued":
      return "border-neutral-500 text-neutral-600";
    case "running":
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
