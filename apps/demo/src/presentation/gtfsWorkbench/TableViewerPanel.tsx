import { useEffect, useState } from 'react';

import { Plus, Rows2, Search, X } from 'lucide-react';

import type { GtfsRow } from '@gtfs-jp/types';

import type { GtfsWhereOperator, OrderCondition, WhereCondition } from '../../domain/gtfsWorkbench';
import { GTFS_WHERE_OPERATORS, ORDER_DIRECTIONS } from '../../domain/gtfsWorkbench';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { DataTable } from './DataTable';

type TableViewerPanelProps = {
  summary: string;
  selectedTable: string;
  tableNames: string[];
  limit: string;
  rows: GtfsRow[];
  busy: boolean;
  isOpen: boolean;
  onSelectedTableChange: (selectedTable: string) => void;
  onLimitChange: (limit: string) => void;
  onReadRows: (
    columns?: string[],
    whereConditions?: WhereCondition[],
    orderConditions?: OrderCondition[],
  ) => Promise<void>;
  onGetTableColumns: (tableName: string) => Promise<string[]>;
};

export function TableViewerPanel({
  summary,
  selectedTable,
  tableNames,
  limit,
  rows,
  busy,
  isOpen,
  onSelectedTableChange,
  onLimitChange,
  onReadRows,
  onGetTableColumns,
}: TableViewerPanelProps): JSX.Element {
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [whereConditions, setWhereConditions] = useState<WhereCondition[]>([]);
  const [orderConditions, setOrderConditions] = useState<OrderCondition[]>([]);

  useEffect(() => {
    void onGetTableColumns(selectedTable).then((cols) => {
      setAvailableColumns(cols);
      setSelectedColumns(new Set(cols));
      setWhereConditions([]);
      setOrderConditions([]);
    });
  }, [selectedTable, onGetTableColumns]);

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });
  };

  const addCondition = () => {
    const firstCol = availableColumns[0] ?? '';
    setWhereConditions((prev) => [...prev, { column: firstCol, operator: '=', value: '' }]);
  };

  const updateCondition = (index: number, patch: Partial<WhereCondition>) => {
    setWhereConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeCondition = (index: number) => {
    setWhereConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const addOrderCondition = () => {
    const firstCol = availableColumns[0] ?? '';
    setOrderConditions((prev) => [...prev, { column: firstCol, direction: 'asc' }]);
  };

  const updateOrderCondition = (index: number, patch: Partial<OrderCondition>) => {
    setOrderConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeOrderCondition = (index: number) => {
    setOrderConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRead = () => {
    const columns =
      availableColumns.length > 0
        ? availableColumns.filter((c) => selectedColumns.has(c))
        : undefined;
    void onReadRows(columns, whereConditions, orderConditions);
  };

  return (
    <Card className="border-black bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rows2 className="h-4 w-4" />
          Table Viewer
        </CardTitle>
        <CardDescription>{summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_140px_120px]">
          <div className="space-y-2">
            <Label htmlFor="table">Table</Label>
            <select
              id="table"
              className="h-10 w-full rounded-md border border-black bg-white px-3 text-sm text-black outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-black"
              value={selectedTable}
              onChange={(event) => onSelectedTableChange(event.target.value)}
              disabled={busy || !isOpen || tableNames.length === 0}
            >
              {tableNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="limit">Limit</Label>
            <Input
              id="limit"
              type="number"
              min={1}
              max={5000}
              value={limit}
              onChange={(event) => onLimitChange(event.target.value)}
              disabled={busy || !isOpen}
            />
          </div>

          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={
                busy ||
                !isOpen ||
                tableNames.length === 0 ||
                (availableColumns.length > 0 && selectedColumns.size === 0)
              }
              onClick={handleRead}
            >
              <Search className="h-4 w-4" />
              Read
            </Button>
          </div>
        </div>

        {availableColumns.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Columns</Label>
              <button
                type="button"
                onClick={() => setSelectedColumns(new Set(availableColumns))}
                className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-50"
              >
                全選択
              </button>
              <button
                type="button"
                onClick={() => setSelectedColumns(new Set())}
                className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-50"
              >
                全解除
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              {availableColumns.map((col) => (
                <label key={col} className="flex cursor-pointer items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(col)}
                    onChange={() => toggleColumn(col)}
                    className="cursor-pointer"
                  />
                  <span className="font-mono">{col}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {availableColumns.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Where</Label>
              <button
                type="button"
                onClick={addCondition}
                disabled={busy || !isOpen}
                className="flex items-center gap-1 rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
                条件を追加
              </button>
            </div>
            {whereConditions.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                {whereConditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {idx > 0 && (
                      <span className="w-8 text-right text-xs font-medium text-neutral-400">
                        AND
                      </span>
                    )}
                    {idx === 0 && <span className="w-8" />}
                    <select
                      value={cond.column}
                      onChange={(e) => updateCondition(idx, { column: e.target.value })}
                      disabled={busy}
                      className="h-7 rounded border border-neutral-300 bg-white px-2 font-mono text-xs outline-none focus:ring-1 focus:ring-black"
                    >
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cond.operator.toString()}
                      onChange={(e) =>
                        updateCondition(idx, {
                          operator: e.target.value as GtfsWhereOperator,
                        })
                      }
                      disabled={busy}
                      className="h-7 rounded border border-neutral-300 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-black"
                    >
                      {GTFS_WHERE_OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={cond.value}
                      onChange={(e) => updateCondition(idx, { value: e.target.value })}
                      disabled={busy || cond.operator === 'is' || cond.operator === 'is not'}
                      className="h-7 w-40 font-mono text-xs"
                      placeholder={
                        cond.operator === 'is' || cond.operator === 'is not'
                          ? 'NULL'
                          : cond.operator === 'in' || cond.operator === 'not in'
                            ? 'val1, val2, ...'
                            : 'value'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeCondition(idx)}
                      disabled={busy}
                      className="text-neutral-400 hover:text-neutral-700 disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {availableColumns.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Order</Label>
              <button
                type="button"
                onClick={addOrderCondition}
                disabled={busy || !isOpen}
                className="flex items-center gap-1 rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
                条件を追加
              </button>
            </div>
            {orderConditions.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                {orderConditions.map((ord, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {idx > 0 && (
                      <span className="w-8 text-right text-xs font-medium text-neutral-400">,</span>
                    )}
                    {idx === 0 && <span className="w-8" />}
                    <select
                      value={ord.column}
                      onChange={(e) => updateOrderCondition(idx, { column: e.target.value })}
                      disabled={busy}
                      className="h-7 rounded border border-neutral-300 bg-white px-2 font-mono text-xs outline-none focus:ring-1 focus:ring-black"
                    >
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                    <select
                      value={ord.direction}
                      onChange={(e) =>
                        updateOrderCondition(idx, {
                          direction: e.target.value as OrderCondition['direction'],
                        })
                      }
                      disabled={busy}
                      className="h-7 rounded border border-neutral-300 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-black"
                    >
                      {ORDER_DIRECTIONS.map((dir) => (
                        <option key={dir} value={dir}>
                          {dir}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeOrderCondition(idx)}
                      disabled={busy}
                      className="text-neutral-400 hover:text-neutral-700 disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="max-h-[560px] overflow-auto rounded-lg border border-black bg-white">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-neutral-600">0 rows</div>
          ) : (
            <DataTable rows={rows} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
