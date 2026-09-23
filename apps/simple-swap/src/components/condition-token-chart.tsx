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
    includeTargetInRange,
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

interface Props {
    token: TokenCacheData;
    baseToken?: TokenCacheData | null;
    targetPrice: string;
    direction?: 'lt' | 'gt';
    onTargetPriceChange: (price: string) => void;
    colour?: string;
}

function ChartSkeleton() {
    return (
        <div className="w-full h-[220px] bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm rounded-lg flex items-center justify-center">
            <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading chart data...</span>
            </div>
        </div>
    );
}

function ChartError({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="w-full h-[220px] bg-white/[0.03] border border-red-500/[0.15] rounded-lg flex flex-col items-center justify-center space-y-3">
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

function EmptyChart({ token }: { token: TokenCacheData }) {
    return (
        <div className="w-full h-[220px] bg-white/[0.03] border border-white/[0.08] rounded-lg flex flex-col items-center justify-center space-y-2">
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
    colour = "#3b82f6"
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const priceLineRef = useRef<IPriceLine | null>(null);

    // Latest values read from inside chart callbacks, so changing them never rebuilds the chart
    const targetRef = useRef<number | null>(null);
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

        const series = chart.addSeries(LineSeries, {
            color: colour,
            lineWidth: 2,
            autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => includeTargetInRange(original(), targetRef.current),
        });
        series.setData(data);
        chart.timeScale().fitContent();

        chart.subscribeClick((param) => {
            if (!param.point) return;
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
        };
        // colour is applied by its own effect below
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    useEffect(() => {
        seriesRef.current?.applyOptions({ color: colour });
    }, [colour]);

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
        <div>
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
                <ChartSkeleton />
            ) : error ? (
                <ChartError error={error} onRetry={() => setReloadKey((k) => k + 1)} />
            ) : !data || data.length === 0 ? (
                <EmptyChart token={token} />
            ) : (
                <div ref={containerRef} className="w-full h-[220px]" />
            )}
        </div>
    );
}
