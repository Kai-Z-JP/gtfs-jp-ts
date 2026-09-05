import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';

import type { GtfsRow } from '@gtfs-jp/types';

import { stringifyValue } from '../../domain/gtfsWorkbench';

const ROW_HEIGHT = 37;
const OVERSCAN_ROWS = 10;
const MAX_TABLE_HEIGHT = 560;

type DataTableProps = {
  rows: ReadonlyArray<GtfsRow | undefined>;
  columns?: string[];
  resetKey?: number | null;
  onRowsNeeded?: (startIndex: number, endIndex: number) => void;
};

export function DataTable({
  rows,
  columns: providedColumns,
  resetKey,
  onRowsNeeded,
}: DataTableProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(MAX_TABLE_HEIGHT);

  const columns = useMemo(
    () =>
      providedColumns ??
      Array.from(
        rows.reduce((set, row) => {
          if (!row) {
            return set;
          }

          for (const key of Object.keys(row)) {
            set.add(key);
          }
          return set;
        }, new Set<string>()),
      ),
    [providedColumns, rows],
  );

  const columnKey = columns.join('\u001f');

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    const updateContainerHeight = () => {
      setContainerHeight(scrollElement.clientHeight || MAX_TABLE_HEIGHT);
    };

    updateContainerHeight();

    if ('ResizeObserver' in globalThis) {
      const resizeObserver = new ResizeObserver(updateContainerHeight);
      resizeObserver.observe(scrollElement);
      return () => resizeObserver.disconnect();
    }

    globalThis.addEventListener('resize', updateContainerHeight);
    return () => globalThis.removeEventListener('resize', updateContainerHeight);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [columnKey, resetKey, rows.length]);

  const totalHeight = rows.length * ROW_HEIGHT;
  const maxScrollTop = Math.max(0, totalHeight - containerHeight);
  const boundedScrollTop = Math.min(scrollTop, maxScrollTop);
  const startIndex = Math.max(0, Math.floor(boundedScrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((boundedScrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN_ROWS,
  );
  const visibleRows = rows.slice(startIndex, endIndex);
  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = (rows.length - endIndex) * ROW_HEIGHT;

  useEffect(() => {
    if (rows.length > 0 && columns.length > 0) {
      onRowsNeeded?.(startIndex, endIndex);
    }
  }, [columns.length, endIndex, onRowsNeeded, rows.length, startIndex]);

  if (rows.length === 0) {
    return (
      <div className="max-h-[560px] overflow-auto rounded-lg border border-black bg-white">
        <div className="px-4 py-6 text-sm text-neutral-600">0 rows</div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="max-h-[560px] overflow-auto rounded-lg border border-black bg-white">
        <div className="px-4 py-6 text-sm text-neutral-600">0 columns selected</div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-[560px] overflow-auto rounded-lg border border-black bg-white"
      onScroll={handleScroll}
    >
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-neutral-100">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="border-b border-black px-3 py-2 text-xs uppercase tracking-wide text-neutral-700"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topSpacerHeight > 0 && (
            <tr aria-hidden="true" style={{ height: topSpacerHeight }}>
              <td colSpan={columns.length} className="p-0" />
            </tr>
          )}
          {visibleRows.map((row, visibleRowIndex) => {
            const rowIndex = startIndex + visibleRowIndex;

            if (!row) {
              return (
                <tr key={rowIndex} className="h-9 border-b border-neutral-200">
                  <td
                    colSpan={columns.length}
                    className="px-3 py-0 text-xs text-neutral-400"
                    style={{ height: ROW_HEIGHT }}
                  >
                    Loading row {rowIndex + 1}
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={rowIndex}
                className="border-b border-neutral-300"
                style={{ height: ROW_HEIGHT }}
              >
                {columns.map((column) => (
                  <td
                    key={`${rowIndex}-${column}`}
                    className="max-w-[320px] truncate px-3 py-0 text-black"
                  >
                    {stringifyValue(row[column])}
                  </td>
                ))}
              </tr>
            );
          })}
          {bottomSpacerHeight > 0 && (
            <tr aria-hidden="true" style={{ height: bottomSpacerHeight }}>
              <td colSpan={columns.length} className="p-0" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
