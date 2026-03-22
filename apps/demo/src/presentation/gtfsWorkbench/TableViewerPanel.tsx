import {Rows2, Search} from "lucide-react";

import type {GtfsRow} from "@gtfs-jp/types";

import {Button} from "../../components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "../../components/ui/card";
import {Input} from "../../components/ui/input";
import {Label} from "../../components/ui/label";
import {DataTable} from "./DataTable";

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
  onReadRows: () => Promise<void>;
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
                                 }: TableViewerPanelProps): JSX.Element {
  return (
    <Card className="border-black bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rows2 className="h-4 w-4"/>
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
            <Button className="w-full" disabled={busy || !isOpen || tableNames.length === 0}
                    onClick={() => void onReadRows()}>
              <Search className="h-4 w-4"/>
              Read
            </Button>
          </div>
        </div>

        <div className="max-h-[560px] overflow-auto rounded-lg border border-black bg-white">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-neutral-600">0 rows</div>
          ) : (
            <DataTable rows={rows}/>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
