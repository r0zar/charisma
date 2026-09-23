"use client";

import React, { useRef, useState, useEffect } from "react";
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type IPriceLine,
    type AutoscaleInfo,
    type LineData,
    type UTCTimestamp,
    LineSeries,
    ColorType,
    LineStyle,
} from "lightweight-charts";
import { TokenCacheData } from "@/lib/contract-registry-adapter";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import {
    calculateSimpleRatio,
    cleanPriceData,
    formatPrice,
    includeTargetsInRange,
    isValidPrice,
} from "@/lib/charts/simple-chart-utils";
import { usePrices } from '@/contexts/token-price-context';
import { usePriceSeriesService } from '@/lib/charts/price-series-service';

type Timeframe = '24h' | '7d' | '30d';
const TIMEFRAMES: { value: Timeframe; label: string }[] = [
    { value: '24h', label: '24H' },
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
];

/**
 * Sell and buy lines drawn from "now" to the end of the run with a shared tilt.
 * Must be present from the chart's first render; the band cannot be added or removed after the chart is built.
 */
export interface ChartBand {
    sell: number;
    buy: number;
    tilt: number;
    windows: number;
    intervalHours: number;
    /** Called while dragging a line, with the new start price for that line. */
    onDrag: (line: 'sell' | 'buy', price: number) => void;
}

interface Props {
    token: TokenCacheData;
    baseToken?: TokenCacheData | null;
    targetPrice: string;
    direction?: 'lt' | 'gt';
    onTargetPriceChange: (price: string) => void;
    colour?: string;
    band?: ChartBand;
    /** Height classes for the chart area (and its loading/error/empty states). */
    className?: string;
}

const HOUR = 3600;

/**
 * Fraction of the tilt applied at unix time `t`. Matches the orders (`lineAt`): full tilt is reached at the
 * START of the last window, so the line keeps its slope through the last window to run end (no clamp).
 */
function tiltFrac(t: number, from: number, band: ChartBand): number {
    return band.windows > 1 ? (t - from) / ((band.windows - 1) * band.intervalHours * HOUR) : 0;
}

/** Points for one band line from `from` (unix s) to the end of the run, one per hour so the future is drawn to scale. */
function bandPoints(start: number, band: ChartBand, from: number): LineData[] {
    const endTime = from + band.windows * band.intervalHours * HOUR;
    const points: LineData[] = [];
    let t = from;
    for (; t <= endTime; t += HOUR) {
        points.push({ time: t as UTCTimestamp, value: start * (1 + band.tilt * tiltFrac(t, from, band)) });
    }
    if (t - HOUR < endTime) {
        points.push({ time: endTime as UTCTimestamp, value: start * (1 + band.tilt * tiltFrac(endTime, from, band)) });
    }
    return points;
}

function ChartSkeleton({ className }: { className: string }) {
    return (
        <div className={`w-full ${className} bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm rounded-lg flex items-center justify-center`}>
            <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading chart data...</span>
            </div>
        </div>
    );
}

function ChartError({ error, onRetry, className }: { error: string; onRetry: () => void; className: string }) {
    return (
        <div className={`w-full ${className} bg-white/[0.03] border border-red-500/[0.15] rounded-lg flex flex-col items-center justify-center space-y-3`}>
            <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Failed to load chart</span>
            </div>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 text-center max-w-xs">{error}</p>
            <button
                onClick={onRetry}
                className="flex items-center space-x-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
                <RefreshCw className="h-3 w-3" />
                <span>Retry</span>
            </button>
        </div>
    );
}

function EmptyChart({ token, className }: { token: TokenCacheData; className: string }) {
    return (
        <div className={`w-full ${className} bg-white/[0.03] border border-white/[0.08] rounded-lg flex flex-col items-center justify-center space-y-2`}>
            <div className="text-muted-foreground text-sm">No price data available</div>
            <div className="text-xs text-muted-foreground/70">No historical data found for {token.symbol}</div>
        </div>
    );
}

export default function ConditionTokenChart({
    token,
    baseToken,
    targetPrice,
    direction = 'gt',
    onTargetPriceChange,
    colour = "#3b82f6",
    band,
    className = 'h-[220px]',
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const priceLineRef = useRef<IPriceLine | null>(null);

    // Latest values read from inside chart callbacks, so changing them never rebuilds the chart
    const targetRef = useRef<number | null>(null);
    const bandRef = useRef<ChartBand | undefined>(band);
    bandRef.current = band;
    const bandSeriesRef = useRef<{ sell: ISeriesApi<'Line'>; buy: ISeriesApi<'Line'> } | null>(null);
    const draggingRef = useRef(false);
    // Horizontal extent of the band last drawn, so only a change in run length refits the time axis
    const bandExtentRef = useRef<string | null>(null);
    const onTargetPriceChangeRef = useRef(onTargetPriceChange);
    onTargetPriceChangeRef.current = onTargetPriceChange;

    const [timeframe, setTimeframe] = useState<Timeframe>('7d');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<LineData[] | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const { getPrice } = usePrices();
    const priceSeriesService = usePriceSeriesService();

    // Subnet tokens share their base token's price feed
    const priceOf = (t: TokenCacheData) => getPrice(t.type === 'SUBNET' && t.base ? t.base : t.contractId);
    const livePrice = priceOf(token);
    const liveBasePrice = baseToken ? priceOf(baseToken) : null;

    const baseContractId = baseToken?.contractId ?? null;

    // Load historical data whenever the pair or timeframe changes
    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const ids = baseContractId ? [token.contractId, baseContractId] : [token.contractId];
                const bulk = await priceSeriesService.fetchBulkPriceSeries(ids, timeframe);
                const tokenData = cleanPriceData(bulk[token.contractId] ?? []);
                const chartData = baseContractId
                    ? calculateSimpleRatio(tokenData, cleanPriceData(bulk[baseContractId] ?? []))
                    : tokenData;
                if (!cancelled) setData(chartData);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load chart data");
                    setData(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [token.contractId, baseContractId, timeframe, priceSeriesService, reloadKey]);

    // Build the chart once per dataset
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !data || data.length === 0) return;

        const chart = createChart(container, {
            autoSize: true,
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#9ca3af",
            },
            grid: {
                vertLines: { color: "rgba(133,133,133,0.1)" },
                horzLines: { color: "rgba(133,133,133,0.1)" },
            },
            timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false },
            leftPriceScale: { visible: true, borderVisible: false, scaleMargins: { top: 0.2, bottom: 0.2 } },
            rightPriceScale: { visible: false },
            localization: { priceFormatter: formatPrice },
        });

        // The chart is rebuilt whenever `data` changes, so the last data time is fixed for this chart's lifetime
        const lastTime = Number(data[data.length - 1].time);
        const series = chart.addSeries(LineSeries, {
            color: colour,
            lineWidth: 2,
            autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
                const b = bandRef.current;
                // Band end values keep the whole band in the vertical range even when it is scrolled out of view horizontally
                const endFrac = b ? tiltFrac(lastTime + b.windows * b.intervalHours * HOUR, lastTime, b) : 0;
                const ends = b ? [b.sell * (1 + b.tilt * endFrac), b.buy * (1 + b.tilt * endFrac)] : [];
                return includeTargetsInRange(original(), [targetRef.current, b?.sell ?? null, b?.buy ?? null, ...ends]);
            },
        });
        series.setData(data);

        if (bandRef.current) {
            const opts = { lineWidth: 2 as const, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false };
            const sell = chart.addSeries(LineSeries, { ...opts, color: '#f97316' });
            const buy = chart.addSeries(LineSeries, { ...opts, color: '#22c55e' });
            sell.setData(bandPoints(bandRef.current.sell, bandRef.current, lastTime));
            buy.setData(bandPoints(bandRef.current.buy, bandRef.current, lastTime));
            bandSeriesRef.current = { sell, buy };
        } else {
            bandSeriesRef.current = null;
        }
        chart.timeScale().fitContent();

        chart.subscribeClick((param) => {
            if (!param.point || draggingRef.current) return;
            const price = series.coordinateToPrice(param.point.y);
            if (price !== null && isValidPrice(price)) {
                onTargetPriceChangeRef.current(price.toString());
            }
        });

        chartRef.current = chart;
        seriesRef.current = series;
        priceLineRef.current = null;

        return () => {
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
            priceLineRef.current = null;
            bandSeriesRef.current = null;
        };
        // colour is applied by its own effect below
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    useEffect(() => {
        seriesRef.current?.applyOptions({ color: colour });
    }, [colour]);

    // Redraw the band when its numbers change
    useEffect(() => {
        const s = bandSeriesRef.current;
        if (!s || !band || !data || data.length === 0) return;
        const lastTime = Number(data[data.length - 1].time);
        s.sell.setData(bandPoints(band.sell, band, lastTime));
        s.buy.setData(bandPoints(band.buy, band, lastTime));
        if (!draggingRef.current) chartRef.current?.priceScale('left').applyOptions({ autoScale: true });

        // Refit the time axis only when the run length changes, so dragging a line keeps the user's zoom
        const extent = `${band.windows}:${band.intervalHours}`;
        if (extent !== bandExtentRef.current) {
            bandExtentRef.current = extent;
            chartRef.current?.timeScale().fitContent();
        }
        // Keyed on the band's numbers, not the object: the page passes a new object every render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [band?.sell, band?.buy, band?.tilt, band?.windows, band?.intervalHours, data]);

    // Drag a band line up or down as a whole
    const hasBand = !!band;
    useEffect(() => {
        const container = containerRef.current;
        const chart = chartRef.current;
        if (!container || !chart || !bandRef.current || !data || data.length === 0) return;

        const HIT_PX = 10;
        let dragging: { line: 'sell' | 'buy'; frac: number; pointerId: number; captured: boolean } | null = null;

        const lineValueAt = (line: 'sell' | 'buy', x: number) => {
            const b = bandRef.current!;
            const lastTime = Number(data[data.length - 1].time);
            const t = chart.timeScale().coordinateToTime(x);
            const time = t === null ? lastTime : Number(t);
            const frac = Math.max(0, tiltFrac(time, lastTime, b));
            const start = line === 'sell' ? b.sell : b.buy;
            return { value: start * (1 + b.tilt * frac), frac };
        };

        const onDown = (e: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            // Time-scale coordinates are pane-relative, so skip the left price scale's width
            const x = e.clientX - rect.left - chart.priceScale('left').width(), y = e.clientY - rect.top;
            const s = bandSeriesRef.current;
            if (!s) return;
            for (const line of ['sell', 'buy'] as const) {
                const { value, frac } = lineValueAt(line, x);
                const ly = s[line].priceToCoordinate(value);
                if (ly !== null && Math.abs(ly - y) <= HIT_PX) {
                    // Capture first: an inactive pointer id (stray or synthetic event) throws, and then no drag starts
                    try { container.setPointerCapture(e.pointerId); } catch { return; }
                    dragging = { line, frac, pointerId: e.pointerId, captured: false };
                    draggingRef.current = true;
                    chart.priceScale('left').applyOptions({ autoScale: false });
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                    container.style.cursor = 'ns-resize';
                    e.preventDefault();
                    return;
                }
            }
        };
        // Moves count only once the browser confirms capture, and only from the captured pointer
        const onCapture = (e: PointerEvent) => {
            if (dragging && e.pointerId === dragging.pointerId) dragging.captured = true;
        };
        const onMove = (e: PointerEvent) => {
            if (!dragging || !dragging.captured || e.pointerId !== dragging.pointerId) return;
            // The pane's top edge is the container's top edge (price scales sit beside it, the time scale below),
            // so this y is pane-relative, the same frame priceToCoordinate used in onDown
            const rect = container.getBoundingClientRect();
            const price = seriesRef.current?.coordinateToPrice(e.clientY - rect.top);
            if (price === null || price === undefined || !isValidPrice(price)) return;
            const b = bandRef.current!;
            // The pointer sits at `frac` along the line; solve back to the start price.
            const next = price / (1 + b.tilt * dragging.frac);
            const current = dragging.line === 'sell' ? b.sell : b.buy;
            // No real move changes a line by more than half its price in one event; drop stray or synthetic jumps
            if (Math.abs(next - current) > current * 0.5) return;
            b.onDrag(dragging.line, next);
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = null;
            draggingRef.current = false;
            chart.priceScale('left').applyOptions({ autoScale: true });
            chart.applyOptions({ handleScroll: true, handleScale: true });
            container.style.cursor = '';
        };

        // Capture phase so the hit test runs before the chart's own canvas handlers see the pointer
        container.addEventListener('pointerdown', onDown, true);
        container.addEventListener('gotpointercapture', onCapture);
        container.addEventListener('pointermove', onMove);
        container.addEventListener('pointerup', onUp);
        container.addEventListener('pointercancel', onUp);
        return () => {
            // A teardown mid-drag must not leave clicks ignored or autoscale frozen
            draggingRef.current = false;
            container.removeEventListener('pointerdown', onDown, true);
            container.removeEventListener('gotpointercapture', onCapture);
            container.removeEventListener('pointermove', onMove);
            container.removeEventListener('pointerup', onUp);
            container.removeEventListener('pointercancel', onUp);
        };
        // Depend on whether a band exists, not the band object: the page passes a new
        // object every render and re-running this effect mid-drag would drop the drag.
        // All band values are read through bandRef.
    }, [hasBand, data]);

    // Draw the target line. Depends on `data` so it re-runs after the chart is rebuilt.
    useEffect(() => {
        const series = seriesRef.current;
        if (!series) return;

        if (priceLineRef.current) {
            series.removePriceLine(priceLineRef.current);
            priceLineRef.current = null;
        }

        const price = parseFloat(targetPrice);
        targetRef.current = isValidPrice(price) ? price : null;

        if (targetRef.current !== null) {
            priceLineRef.current = series.createPriceLine({
                price: targetRef.current,
                color: "#f97316",
                lineWidth: 2,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: `Target ${direction === 'gt' ? '≥' : '≤'}`,
            });
        }

        // Re-run autoscale so the line is always on screen
        chartRef.current?.priceScale('left').applyOptions({ autoScale: true });
    }, [targetPrice, direction, data]);

    // Append the live price as the newest point
    useEffect(() => {
        const series = seriesRef.current;
        if (!series || !data || data.length === 0 || !isValidPrice(livePrice ?? NaN)) return;

        let value = livePrice as number;
        if (baseContractId) {
            if (!isValidPrice(liveBasePrice ?? NaN)) return;
            value = value / (liveBasePrice as number);
        }

        const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
        if (now < Number(data[data.length - 1].time)) return;
        series.update({ time: now, value });
    }, [livePrice, liveBasePrice, baseContractId, data]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-end gap-1 mb-2">
                {TIMEFRAMES.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => setTimeframe(value)}
                        className={`px-2 py-0.5 text-xs rounded transition-colors ${timeframe === value
                            ? 'bg-white/[0.1] text-white/95'
                            : 'text-white/50 hover:text-white/80'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {loading ? (
                <ChartSkeleton className={className} />
            ) : error ? (
                <ChartError error={error} onRetry={() => setReloadKey((k) => k + 1)} className={className} />
            ) : !data || data.length === 0 ? (
                <EmptyChart token={token} className={className} />
            ) : (
                <div ref={containerRef} className={`w-full ${className}`} style={{ touchAction: band ? 'none' : undefined }} />
            )}
        </div>
    );
}
