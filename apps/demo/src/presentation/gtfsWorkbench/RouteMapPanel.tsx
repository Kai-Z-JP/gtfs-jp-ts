import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  NavigationControl,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BusFront, CalendarDays, Info, MapPin, RefreshCw, Route } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import type {
  RouteMapData,
  RouteMapOptions,
  RouteMapStopDetail,
  RouteMapStopInfo,
  RouteMapTimetableRow,
} from '../../domain/gtfsWorkbench';

type RouteMapPanelProps = {
  busy: boolean;
  isOpen: boolean;
  onLoadRouteMapOptions: () => Promise<RouteMapOptions>;
  onLoadRouteMapData: (options: { routeId?: string; serviceDate: string }) => Promise<RouteMapData>;
  onLoadStopDetail: (options: {
    stopId: string;
    routeId?: string;
    serviceDate: string;
  }) => Promise<RouteMapStopDetail>;
};

const emptyRouteMapData: RouteMapData = {
  routeLines: {
    type: 'FeatureCollection',
    features: [],
  },
  parentStops: {
    type: 'FeatureCollection',
    features: [],
  },
  poles: {
    type: 'FeatureCollection',
    features: [],
  },
  bounds: null,
  stats: {
    routeLineCount: 0,
    parentStopCount: 0,
    poleCount: 0,
  },
  warnings: [],
};

const mapStyle = {
  version: 8,
  sources: {
    gsi: {
      type: 'raster',
      tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
    },
  },
  layers: [
    {
      id: 'gsi',
      type: 'raster',
      source: 'gsi',
    },
  ],
} satisfies StyleSpecification;

const routeLineLayer = {
  id: 'route-lines-layer',
  type: 'line',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': ['case', ['get', 'fallback'], 3, 4],
    'line-opacity': ['case', ['get', 'fallback'], 0.58, 0.82],
  },
} as const satisfies LayerProps;

const parentStopsLayer = {
  id: 'parent-stops-layer',
  type: 'circle',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 8],
    'circle-color': '#f8fafc',
    'circle-stroke-color': '#111827',
    'circle-stroke-width': 2,
  },
} as const satisfies LayerProps;

const polesLayer = {
  id: 'poles-layer',
  type: 'circle',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 5],
    'circle-color': '#0f766e',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1.5,
  },
} as const satisfies LayerProps;

const formatStopType = (stop: RouteMapStopInfo): string => {
  if (stop.locationType === 1) return '停留所';
  if (stop.locationType === 0 || stop.locationType == null) return '標柱/乗り場';
  return `location_type ${stop.locationType}`;
};

const formatWheelchair = (value: number | null): string => {
  if (value === 1) return '対応';
  if (value === 2) return '非対応';
  if (value === 0) return '情報なし';
  return '-';
};

const formatStopHeading = (stop: RouteMapStopInfo): string => {
  const platform = stop.platformCode ? ` ${stop.platformCode}` : '';
  return `${stop.stopName}${platform}`;
};

const renderTime = (row: RouteMapTimetableRow): string => {
  if (row.departureTime && row.arrivalTime && row.departureTime !== row.arrivalTime) {
    return `${row.arrivalTime} / ${row.departureTime}`;
  }
  return row.departureTime ?? row.arrivalTime ?? '-';
};

function WarningIndicator({ messages }: { messages: string[] }): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="group relative">
      <button
        type="button"
        aria-label={`warnings ${messages.length} 件`}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        onClick={() => setOpen((current) => !current)}
      >
        <Info className="h-4 w-4" />
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-black px-1 text-[10px] font-semibold leading-4 text-white">
          {messages.length}
        </span>
      </button>

      <div
        className={`absolute right-0 top-10 z-10 w-[min(24rem,calc(100vw-3rem))] rounded-md border border-neutral-300 bg-white p-3 text-xs text-neutral-700 shadow-lg ${
          open ? 'block' : 'hidden group-focus-within:block group-hover:block'
        }`}
      >
        <p className="mb-2 text-xs font-semibold text-black">Warnings</p>
        <div className="space-y-1">
          {messages.map((message, index) => (
            <p key={`${message}-${index}`}>{message}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RouteMapPanel({
  busy,
  isOpen,
  onLoadRouteMapOptions,
  onLoadRouteMapData,
  onLoadStopDetail,
}: RouteMapPanelProps): JSX.Element {
  const mapRef = useRef<MapRef>(null);
  const [options, setOptions] = useState<RouteMapOptions | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [showParentStops, setShowParentStops] = useState(true);
  const [showPoles, setShowPoles] = useState(true);
  const [mapData, setMapData] = useState<RouteMapData>(emptyRouteMapData);
  const [selectedStopDetail, setSelectedStopDetail] = useState<RouteMapStopDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const routeIdForQuery = selectedRouteId || undefined;

  const loadOptions = useCallback(async () => {
    if (!isOpen) {
      setOptions(null);
      setMapData(emptyRouteMapData);
      setSelectedStopDetail(null);
      setErrorMessage('');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const loadedOptions = await onLoadRouteMapOptions();
      setOptions(loadedOptions);
      setServiceDate((current) => current || loadedOptions.defaultServiceDate);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [isOpen, onLoadRouteMapOptions]);

  const loadData = useCallback(async () => {
    if (!isOpen || !serviceDate) {
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const loadedMapData = await onLoadRouteMapData({
        routeId: routeIdForQuery,
        serviceDate,
      });
      setMapData(loadedMapData);
      setSelectedStopDetail(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [isOpen, onLoadRouteMapData, routeIdForQuery, serviceDate]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!mapData.bounds || !mapRef.current) {
      return;
    }

    mapRef.current.fitBounds(mapData.bounds, {
      padding: 48,
      duration: 450,
      maxZoom: 15,
    });
  }, [mapData.bounds]);

  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = [];
    if (showParentStops) ids.push('parent-stops-layer');
    if (showPoles) ids.push('poles-layer');
    return ids;
  }, [showParentStops, showPoles]);

  const selectStop = useCallback(
    (stopId: string) => {
      setDetailLoading(true);
      setErrorMessage('');
      void onLoadStopDetail({
        stopId,
        routeId: routeIdForQuery,
        serviceDate,
      })
        .then(setSelectedStopDetail)
        .catch((error: unknown) => {
          setErrorMessage(error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          setDetailLoading(false);
        });
    },
    [onLoadStopDetail, routeIdForQuery, serviceDate],
  );

  const handleMapClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.find((entry) => interactiveLayerIds.includes(entry.layer.id));
    const stopId = feature?.properties?.stopId;
    if (typeof stopId !== 'string') {
      return;
    }

    selectStop(stopId);
  };

  const warningMessages = [...(options?.warnings ?? []), ...mapData.warnings];
  const disabled = busy || loading || !isOpen;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="border-black bg-white">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                Route Map
              </CardTitle>
              <CardDescription>
                GTFS-JP の路線・停留所・標柱を地図上で確認できます。
              </CardDescription>
            </div>
            {warningMessages.length > 0 && <WarningIndicator messages={warningMessages} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_260px_auto]">
            <div className="space-y-2">
              <Label htmlFor="route-map-route">路線</Label>
              <select
                id="route-map-route"
                className="h-10 w-full rounded-md border border-black bg-white px-3 text-sm text-black outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-black"
                value={selectedRouteId}
                onChange={(event) => setSelectedRouteId(event.target.value)}
                disabled={disabled || !options}
              >
                <option value="">（指定なし）</option>
                {(options?.routes ?? []).map((route) => (
                  <option key={route.routeId} value={route.routeId}>
                    {route.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="route-map-date">運行日</Label>
              <input
                id="route-map-date"
                type="date"
                min={options?.feedStartDate || undefined}
                max={options?.feedEndDate || undefined}
                className="h-10 w-full rounded-md border border-black bg-white px-3 text-sm text-black outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-black"
                value={serviceDate}
                onChange={(event) => setServiceDate(event.target.value)}
                disabled={disabled || !options}
              />
            </div>

            <div className="grid grid-cols-2 content-end gap-2">
              <label className="flex h-10 items-center justify-between rounded-md border border-black px-3 text-sm">
                停留所
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-black"
                  checked={showParentStops}
                  onChange={(event) => setShowParentStops(event.target.checked)}
                />
              </label>
              <label className="flex h-10 items-center justify-between rounded-md border border-black px-3 text-sm">
                標柱
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-black"
                  checked={showPoles}
                  onChange={(event) => setShowPoles(event.target.checked)}
                />
              </label>
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                variant="outline"
                disabled={disabled}
                onClick={() => void loadData()}
              >
                <RefreshCw className="h-4 w-4" />
                リロード
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-neutral-700">
            <Badge variant="outline">系統 {mapData.stats.routeLineCount}</Badge>
            <Badge variant="outline">停留所 {mapData.stats.parentStopCount}</Badge>
            <Badge variant="outline">標柱 {mapData.stats.poleCount}</Badge>
            {loading && <Badge>Loading</Badge>}
          </div>

          {errorMessage && (
            <p className="rounded-md border border-black bg-white px-3 py-2 text-sm text-black">
              {errorMessage}
            </p>
          )}

          {!isOpen && (
            <p className="rounded-md border border-dashed border-black px-3 py-3 text-sm text-neutral-600">
              Load タブで DB を開き、GTFS ZIP を読み込むと地図を表示できます。
            </p>
          )}

          <div className="h-[620px] min-h-[420px] overflow-hidden rounded-md border border-black">
            <Map
              ref={mapRef}
              initialViewState={{
                longitude: 139.767,
                latitude: 35.681,
                zoom: 10,
              }}
              mapStyle={mapStyle}
              interactiveLayerIds={interactiveLayerIds}
              onClick={handleMapClick}
              cursor={interactiveLayerIds.length > 0 ? 'pointer' : 'grab'}
              attributionControl={{ compact: true }}
            >
              <NavigationControl position="top-left" />
              <Source id="route-lines" type="geojson" data={mapData.routeLines}>
                <Layer {...routeLineLayer} />
              </Source>
              <Source id="parent-stops" type="geojson" data={mapData.parentStops}>
                {showParentStops && <Layer {...parentStopsLayer} />}
              </Source>
              <Source id="poles" type="geojson" data={mapData.poles}>
                {showPoles && <Layer {...polesLayer} />}
              </Source>
            </Map>
          </div>
        </CardContent>
      </Card>

      <StopDetailPanel
        detail={selectedStopDetail}
        loading={detailLoading}
        onSelectStop={selectStop}
      />
    </div>
  );
}

function StopDetailPanel({
  detail,
  loading,
  onSelectStop,
}: {
  detail: RouteMapStopDetail | null;
  loading: boolean;
  onSelectStop: (stopId: string) => void;
}): JSX.Element {
  const parentStopId = detail?.selectedStop.parentStation;

  return (
    <Card className="border-black bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          停留所/標柱情報
        </CardTitle>
        <CardDescription>地図上の停留所または標柱をクリックしてください。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <p className="rounded-md border border-black px-3 py-2 text-sm">時刻表を読込中です。</p>
        )}

        {!detail && !loading && (
          <p className="rounded-md border border-dashed border-black px-3 py-3 text-sm text-neutral-600">
            選択中の停留所/標柱はありません。
          </p>
        )}

        {detail && !loading && (
          <>
            <section className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    {formatStopType(detail.selectedStop)}
                  </p>
                  <h3 className="text-lg font-semibold">
                    {formatStopHeading(detail.selectedStop)}
                  </h3>
                </div>
                <Badge variant="outline">{detail.selectedStop.stopId}</Badge>
              </div>
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-neutral-500">stop_code</dt>
                <dd>{detail.selectedStop.stopCode ?? '-'}</dd>
                <dt className="text-neutral-500">parent</dt>
                <dd>
                  {parentStopId ? (
                    <button
                      type="button"
                      className="rounded-sm font-mono underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-wait disabled:opacity-60"
                      onClick={() => onSelectStop(parentStopId)}
                      disabled={loading}
                    >
                      {parentStopId}
                    </button>
                  ) : (
                    '-'
                  )}
                </dd>
                <dt className="text-neutral-500">platform</dt>
                <dd>{detail.selectedStop.platformCode ?? '-'}</dd>
                <dt className="text-neutral-500">timezone</dt>
                <dd>{detail.selectedStop.stopTimezone ?? '-'}</dd>
                <dt className="text-neutral-500">wheelchair</dt>
                <dd>{formatWheelchair(detail.selectedStop.wheelchairBoarding)}</dd>
                <dt className="text-neutral-500">stop_url</dt>
                <dd>
                  {detail.selectedStop.stopUrl ? (
                    <a
                      className="break-all text-sm font-medium underline"
                      href={detail.selectedStop.stopUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {detail.selectedStop.stopUrl}
                    </a>
                  ) : (
                    '-'
                  )}
                </dd>
              </dl>
              {detail.selectedStop.stopDesc && (
                <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  {detail.selectedStop.stopDesc}
                </p>
              )}
            </section>

            {detail.childStops.length > 0 && (
              <section className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <BusFront className="h-4 w-4" />
                  子標柱
                </h4>
                <div className="max-h-36 space-y-1 overflow-auto rounded-md border border-neutral-200 p-2">
                  {detail.childStops.map((stop) => (
                    <button
                      key={stop.stopId}
                      type="button"
                      className="block w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-wait disabled:opacity-60"
                      onClick={() => onSelectStop(stop.stopId)}
                      disabled={loading}
                    >
                      <span className="font-medium">{formatStopHeading(stop)}</span>
                      <span className="ml-2 font-mono text-neutral-500">{stop.stopId}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {detail.warnings.length > 0 && (
              <div className="space-y-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                {detail.warnings.map((message, index) => (
                  <p key={`${message}-${index}`}>{message}</p>
                ))}
              </div>
            )}

            <section className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="h-4 w-4" />
                時刻表
              </h4>
              {detail.timetableGroups.every((group) => group.rows.length === 0) ? (
                <p className="rounded-md border border-dashed border-black px-3 py-3 text-sm text-neutral-600">
                  選択した日付に運行する便はありません。
                </p>
              ) : (
                <div className="max-h-[480px] space-y-4 overflow-auto pr-1">
                  {detail.timetableGroups.map((group) => (
                    <TimetableGroupView key={group.stop.stopId} group={group} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TimetableGroupView({
  group,
}: {
  group: { stop: RouteMapStopInfo; rows: RouteMapTimetableRow[] };
}): JSX.Element {
  if (group.rows.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-sm">
          <span className="font-semibold">{formatStopHeading(group.stop)}</span>
          <span className="ml-2 font-mono text-neutral-500">{group.stop.stopId}</span>
        </p>
        <p className="rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500">
          この標柱の便はありません。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">
        <span className="font-semibold">{formatStopHeading(group.stop)}</span>
        <span className="ml-2 font-mono text-neutral-500">{group.stop.stopId}</span>
      </p>
      <div className="overflow-auto rounded-md border border-neutral-200">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          <thead className="bg-neutral-100">
            <tr>
              <th className="border-b border-neutral-200 px-2 py-1.5">時刻</th>
              <th className="border-b border-neutral-200 px-2 py-1.5">路線</th>
              <th className="border-b border-neutral-200 px-2 py-1.5">行先</th>
              <th className="border-b border-neutral-200 px-2 py-1.5">dir</th>
              <th className="border-b border-neutral-200 px-2 py-1.5">seq</th>
              <th className="border-b border-neutral-200 px-2 py-1.5">stop</th>
              <th className="border-b border-neutral-200 px-2 py-1.5">trip</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <tr key={`${row.tripId}-${row.stopId}-${row.stopSequence}`}>
                <td className="border-b border-neutral-100 px-2 py-1.5 font-mono">
                  {renderTime(row)}
                </td>
                <td className="border-b border-neutral-100 px-2 py-1.5">{row.routeLabel}</td>
                <td className="border-b border-neutral-100 px-2 py-1.5">
                  {row.tripHeadsign ?? '-'}
                </td>
                <td className="border-b border-neutral-100 px-2 py-1.5">
                  {row.directionId ?? '-'}
                </td>
                <td className="border-b border-neutral-100 px-2 py-1.5">{row.stopSequence}</td>
                <td className="border-b border-neutral-100 px-2 py-1.5 font-mono">
                  {row.platformCode ? `${row.stopId} / ${row.platformCode}` : row.stopId}
                </td>
                <td className="border-b border-neutral-100 px-2 py-1.5 font-mono">{row.tripId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
