import type { GtfsJpV4TableRow } from './types.js';

/**
 * Minimal structural constraint for stop rows.
 * GtfsJpV4TableRow<'stops'> satisfies this interface.
 */
export interface StopRow {
  stop_id: string;
  parent_station?: string | null;
  [key: string]: unknown;
}

export interface StopNode<TRow extends StopRow = GtfsJpV4TableRow<'stops'>> {
  row: TRow;
  parent: StopNode<TRow> | null;
  children: StopNode<TRow>[];
}

export interface StopHierarchy<TRow extends StopRow = GtfsJpV4TableRow<'stops'>> {
  /** Root nodes (stops with no parent_station) */
  roots: StopNode<TRow>[];
  /** All nodes indexed by stop_id */
  byId: Map<string, StopNode<TRow>>;
}

/**
 * Builds a stop hierarchy tree from an array of stop rows.
 *
 * Accepts GtfsJpV4TableRow<'stops'> directly from loader.readTable('stops').
 * The generic parameter allows enriched row types as well.
 *
 * Stops with a `parent_station` value are attached as children of that node.
 * Stops without a `parent_station` (or whose parent is not in the list) are
 * placed at the root level.
 */
export const buildStopHierarchy = <TRow extends StopRow = GtfsJpV4TableRow<'stops'>>(
  stops: readonly TRow[],
): StopHierarchy<TRow> => {
  const byId = new Map<string, StopNode<TRow>>();

  // First pass: create all nodes
  for (const row of stops) {
    byId.set(row.stop_id, { row, parent: null, children: [] });
  }

  const roots: StopNode<TRow>[] = [];

  // Second pass: wire up parent/child relationships
  for (const node of byId.values()) {
    const parentId = node.row.parent_station;
    if (parentId) {
      const parentNode = byId.get(parentId);
      if (parentNode) {
        node.parent = parentNode;
        parentNode.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  return { roots, byId };
};
