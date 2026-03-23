import { useState } from 'react';

import {
  buildServiceCalendarIndex,
  buildStopHierarchy,
  toGtfsDate,
  gtfsTimeToSeconds,
  secondsToGtfsTime,
  gtfsDateToIsoString,
} from '@gtfs-jp/types';
import type { GtfsValidationResult } from '@gtfs-jp/loader';

import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import type { GtfsLoaderPort } from '../../infrastructure/gtfsLoader';

type Props = {
  isOpen: boolean;
  loader: GtfsLoaderPort | null;
};

// ---------------------------------------------------------------------------
// Section: Time/Date utils (no DB needed)
// ---------------------------------------------------------------------------

function TimeDateSection() {
  const now = new Date();
  const todayGtfs = toGtfsDate(now);
  const todayIso = gtfsDateToIsoString(todayGtfs);
  const sampleTime = '25:30:00';
  const secs = gtfsTimeToSeconds(sampleTime);
  const backToTime = secondsToGtfsTime(secs);

  return (
    <div className="rounded border p-4 space-y-2">
      <h3 className="font-semibold text-sm">GtfsTime / GtfsDate utilities</h3>
      <p className="text-xs text-neutral-500">ライブラリ直接呼び出し (DB不要)</p>
      <div className="text-xs font-mono space-y-1">
        <p>toGtfsDate(today) → <span className="text-blue-700">{todayGtfs}</span></p>
        <p>gtfsDateToIsoString({todayGtfs}) → <span className="text-blue-700">{todayIso}</span></p>
        <p>gtfsTimeToSeconds({sampleTime}) → <span className="text-blue-700">{secs}</span></p>
        <p>secondsToGtfsTime({secs}) → <span className="text-blue-700">{backToTime}</span></p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Validate
// ---------------------------------------------------------------------------

function ValidateSection({ loader }: { loader: GtfsLoaderPort }) {
  const [result, setResult] = useState<GtfsValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await loader.validate());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border p-4 space-y-3">
      <h3 className="font-semibold text-sm">validate()</h3>
      <p className="text-xs text-neutral-500">必須テーブルの存在チェック</p>
      <Button size="sm" onClick={run} disabled={busy}>
        {busy ? '実行中…' : '実行'}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={result.valid ? 'default' : 'destructive'}>
              {result.valid ? 'VALID' : 'INVALID'}
            </Badge>
          </div>
          <p>存在テーブル: {result.presentTables.length} 個</p>
          {result.missingRequired.length > 0 && (
            <p className="text-red-600">必須欠損: {result.missingRequired.join(', ')}</p>
          )}
          {result.missingConditionalRequired.length > 0 && (
            <p className="text-amber-600">
              条件必須欠損: {result.missingConditionalRequired.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Count with where
// ---------------------------------------------------------------------------

function CountSection({ loader }: { loader: GtfsLoaderPort }) {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const total = await loader.count('stops');
      const withName = await loader.count('stops', {
        where: "stop_name IS NOT NULL AND stop_name != ''",
      });
      setResult(`stops: ${total} 件 / stop_name あり: ${withName} 件`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border p-4 space-y-3">
      <h3 className="font-semibold text-sm">count() + where</h3>
      <p className="text-xs text-neutral-500">stops テーブルの件数と stop_name あり件数を取得</p>
      <Button size="sm" onClick={run} disabled={busy}>
        {busy ? '実行中…' : '実行'}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && <p className="text-xs font-mono">{result}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Calendar Index
// ---------------------------------------------------------------------------

function CalendarSection({ loader }: { loader: GtfsLoaderPort }) {
  const [result, setResult] = useState<string[] | null>(null);
  const [date, setDate] = useState<string>(toGtfsDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // readTable returns GtfsJpV4TableRow<TName>[] — no cast needed
      const calRows = await loader.readTable('calendar');
      const cdRows = await loader.readTable('calendar_dates');
      const index = buildServiceCalendarIndex(calRows, cdRows);
      setResult(index.getActiveServiceIds(date));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border p-4 space-y-3">
      <h3 className="font-semibold text-sm">buildServiceCalendarIndex()</h3>
      <p className="text-xs text-neutral-500">指定日に運行するサービス ID 一覧</p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          placeholder="YYYYMMDD"
          className="rounded border px-2 py-1 text-xs font-mono w-32"
        />
        <Button size="sm" onClick={run} disabled={busy}>
          {busy ? '実行中…' : '実行'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && (
        <div className="text-xs space-y-1">
          <p>{result.length} サービスが運行中</p>
          <p className="font-mono text-neutral-600 break-all">
            {result.slice(0, 20).join(', ')}
            {result.length > 20 ? ' …' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Stop Hierarchy
// ---------------------------------------------------------------------------

function StopHierarchySection({ loader }: { loader: GtfsLoaderPort }) {
  const [result, setResult] = useState<{
    roots: number;
    total: number;
    maxChildren: { id: string; count: number } | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // readTable returns GtfsJpV4TableRow<'stops'>[] — passed directly, no cast
      const rows = await loader.readTable('stops');
      const hierarchy = buildStopHierarchy(rows);
      let maxChildren: { id: string; count: number } | null = null;
      for (const [id, node] of hierarchy.byId) {
        if (node.children.length > (maxChildren?.count ?? 0)) {
          maxChildren = { id, count: node.children.length };
        }
      }
      setResult({ roots: hierarchy.roots.length, total: hierarchy.byId.size, maxChildren });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border p-4 space-y-3">
      <h3 className="font-semibold text-sm">buildStopHierarchy()</h3>
      <p className="text-xs text-neutral-500">stops の親子ツリーを構築</p>
      <Button size="sm" onClick={run} disabled={busy}>
        {busy ? '実行中…' : '実行'}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && (
        <div className="text-xs space-y-1">
          <p>
            全停留所: {result.total} 件 / ルートノード: {result.roots} 件
          </p>
          {result.maxChildren && (
            <p>
              最多子ノード: <span className="font-mono">{result.maxChildren.id}</span> (
              {result.maxChildren.count} 件)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function ApiDemoPanel({ isOpen, loader }: Props): JSX.Element {
  if (!isOpen || !loader) {
    return (
      <div className="rounded border border-dashed p-6 text-center text-sm text-neutral-400">
        DB を開いて GTFS ZIP を読み込んでから API Demo を実行してください
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TimeDateSection />
      <ValidateSection loader={loader} />
      <CountSection loader={loader} />
      <CalendarSection loader={loader} />
      <StopHierarchySection loader={loader} />
    </div>
  );
}
