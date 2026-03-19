import type { GtfsRow } from "@gtfs-jp/types";

import { stringifyValue } from "../../domain/gtfsWorkbench";

type DataTableProps = {
  rows: GtfsRow[];
};

export function DataTable({ rows }: DataTableProps): JSX.Element {
  const columns = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) {
        set.add(key);
      }
      return set;
    }, new Set<string>()),
  );

  return (
    <table className="w-full min-w-max border-collapse text-left text-sm">
      <thead className="sticky top-0 z-10 bg-neutral-100">
        <tr>
          {columns.map((column) => (
            <th key={column} className="border-b border-black px-3 py-2 text-xs uppercase tracking-wide text-neutral-700">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-neutral-300">
            {columns.map((column) => (
              <td key={`${rowIndex}-${column}`} className="max-w-[320px] truncate px-3 py-2 text-black">
                {stringifyValue(row[column])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
