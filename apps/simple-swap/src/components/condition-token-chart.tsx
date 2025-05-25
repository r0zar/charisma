"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    LineSeries,
    ColorType,
    type IPriceLine,
    LineStyle,
} from "lightweight-charts";
import { TokenCacheData } from "@repo/tokens";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface Props {
    token: TokenCacheData;
    baseToken?: TokenCacheData | null;
    targetPrice: string;
    onTargetPriceChange: (price: string) => void;
    colour?: string;
}

// Utility functions
function calculateRatioData(tokenData: LineData[], baseData: LineData[]): LineData[] {
    const ratioData: LineData[] = [];
    let baseIdx = 0;
    let currentBase: number | null = null;

    for (const point of tokenData) {
        const timeNum = Number(point.time);
        if (isNaN(timeNum)) continue;

        while (baseIdx < baseData.length && Number(baseData[baseIdx].time) <= timeNum) {
            if (isValidDataPoint(baseData[baseIdx])) {
                currentBase = baseData[baseIdx].value;
            }
            baseIdx++;
        }

        if (currentBase && currentBase !== 0 && !isNaN(currentBase)) {
            ratioData.push({
                time: point.time,
                value: point.value / currentBase
            });
        }
    }

    return ratioData;
}

function isValidDataPoint(point: LineData): boolean {
    return !!(
        point &&
        typeof point.time !== 'undefined' &&
        typeof point.value === 'number' &&
        !isNaN(point.value) &&
        isFinite(point.value)
    );
}

function formatPrice(price: number): string {
    if (price === 0) return '0.00';
    const absPrice = Math.abs(price);
    let decimals = 2;
    if (absPrice < 0.0001) decimals = 8;
    else if (absPrice < 0.01) decimals = 6;
    else if (absPrice < 1) decimals = 4;
    return price.toFixed(decimals);
}

// UI Components
function ChartSkeleton() {
    return (
        <div className="w-full h-[220px] bg-muted/20 rounded-lg flex items-center justify-center">
            <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading chart data...</span>
            </div>
        </div>
    );
}

function ChartError({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="w-full h-[220px] bg-red-500/5 border border-red-500/20 rounded-lg flex flex-col items-center justify-center space-y-3">
            <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Failed to load chart</span>
            </div>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 text-center max-w-xs">
                {error}
            </p>
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
        <div className="w-full h-[220px] bg-muted/10 border border-muted/30 rounded-lg flex flex-col items-center justify-center space-y-2">
            <div className="text-muted-foreground text-sm">No price data available</div>
            <div className="text-xs text-muted-foreground/70">
                No historical data found for {token.symbol}
            </div>
        </div>
    );
}

// Main component
export default function ConditionTokenChart({
    token,
    baseToken,
    targetPrice,
    onTargetPriceChange,
    colour = "#3b82f6"
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const priceLineRef = useRef<IPriceLine | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<LineData[] | null>(null);

    // Fetch data and initialize chart
    const loadChart = useCallback(async () => {
        if (!token?.contractId) return;

        setLoading(true);
        setError(null);

        try {
            // Fetch data
            const [tokenResponse, baseResponse] = await Promise.all([
                fetch(`/api/price-series?contractId=${encodeURIComponent(token.contractId)}`),
                baseToken?.contractId
                    ? fetch(`/api/price-series?contractId=${encodeURIComponent(baseToken.contractId)}`)
                    : Promise.resolve(null)
            ]);

            if (!tokenResponse.ok) {
                throw new Error(`Failed to fetch price data: ${tokenResponse.status}`);
            }

            const tokenData: LineData[] = await tokenResponse.json();

            if (!Array.isArray(tokenData)) {
                throw new Error("Invalid price data format");
            }

            let processedData = tokenData;

            // Process ratio data if base token exists
            if (baseResponse?.ok && baseToken?.contractId) {
                const baseData: LineData[] = await baseResponse.json();
                if (Array.isArray(baseData)) {
                    processedData = calculateRatioData(tokenData, baseData);
                }
            }

            const validData = processedData.filter(isValidDataPoint);
            setData(validData);

        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load chart data";
            setError(message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [token.contractId, baseToken?.contractId]);

    // Initialize chart when container and data are ready
    useEffect(() => {
        if (!containerRef.current || !data || data.length === 0) return;

        let handleKeyDown: ((event: KeyboardEvent) => void) | null = null;
        let handleResize: (() => void) | null = null;

        try {
            // Clean up existing chart
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
                priceLineRef.current = null;
            }

            // Create new chart with minimal configuration for maximum zoom freedom
            chartRef.current = createChart(containerRef.current, {
                height: 220,
                layout: {
                    background: { type: ColorType.Solid, color: "transparent" },
                    textColor: "#9ca3af",
                },
                grid: {
                    vertLines: { color: "rgba(133,133,133,0.1)" },
                    horzLines: { color: "rgba(133,133,133,0.1)" },
                },
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                    borderVisible: false,
                    rightOffset: 12,
                    barSpacing: 3,
                    fixLeftEdge: true,  // Prevent zooming before first data point
                    fixRightEdge: true, // Prevent zooming after last data point
                    lockVisibleTimeRangeOnResize: false,
                    rightBarStaysOnScroll: false,
                    shiftVisibleRangeOnNewBar: false,
                },
                leftPriceScale: {
                    visible: true,
                    borderVisible: false,
                    scaleMargins: { top: 0.2, bottom: 0.2 },
                },
                rightPriceScale: { visible: false },
                localization: {
                    priceFormatter: formatPrice,
                },
                handleScroll: {
                    mouseWheel: true,
                    pressedMouseMove: true,
                    horzTouchDrag: true,
                    vertTouchDrag: true,
                },
                handleScale: {
                    axisPressedMouseMove: {
                        time: true,
                        price: true,
                    },
                    axisDoubleClickReset: {
                        time: true,
                        price: true,
                    },
                    mouseWheel: true,
                    pinch: true,
                },
            });

            seriesRef.current = chartRef.current.addSeries(LineSeries, {
                color: colour,
                lineWidth: 2,
            }) as ISeriesApi<'Line'>;

            // Set data
            seriesRef.current.setData(data);

            // Set proper boundaries - allow zoom out within data range but not beyond
            const firstTime = data[0].time;
            const lastTime = data[data.length - 1].time;

            // Set the chart to show recent data initially, but allow zooming out to see all data
            const recentStartIndex = Math.max(0, data.length - Math.floor(data.length * 0.6));
            const recentStartTime = data[recentStartIndex].time;

            // Set initial visible range to recent data
            chartRef.current.timeScale().setVisibleRange({
                from: recentStartTime,
                to: lastTime,
            });

            // Add debugging for zoom events
            chartRef.current.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
                if (timeRange) {
                    // Prevent zooming beyond data boundaries
                    const clampedFrom = Math.max(Number(firstTime), Number(timeRange.from));
                    const clampedTo = Math.min(Number(lastTime), Number(timeRange.to));

                    // Only adjust if we're actually outside bounds
                    if (Number(timeRange.from) < Number(firstTime) || Number(timeRange.to) > Number(lastTime)) {
                        setTimeout(() => {
                            if (chartRef.current) {
                                chartRef.current.timeScale().setVisibleRange({
                                    from: clampedFrom as any,
                                    to: clampedTo as any,
                                });
                            }
                        }, 0);
                    }

                    console.log('Visible time range:', {
                        from: new Date(Number(timeRange.from) * 1000).toLocaleString(),
                        to: new Date(Number(timeRange.to) * 1000).toLocaleString(),
                        dataStart: new Date(Number(firstTime) * 1000).toLocaleString(),
                        dataEnd: new Date(Number(lastTime) * 1000).toLocaleString(),
                    });
                }
            });

            // Handle clicks
            const handleClick = (param: any) => {
                if (!param.point || !seriesRef.current) return;
                const price = seriesRef.current.coordinateToPrice(param.point.y);
                if (price && !isNaN(price)) {
                    onTargetPriceChange(price.toPrecision(9));
                }
            };

            chartRef.current.subscribeClick(handleClick);

            // Handle resize
            handleResize = () => {
                if (containerRef.current && chartRef.current) {
                    chartRef.current.applyOptions({
                        width: containerRef.current.clientWidth
                    });
                }
            };

            // Add keyboard shortcuts for chart navigation
            handleKeyDown = (event: KeyboardEvent) => {
                if (!chartRef.current) return;

                switch (event.key) {
                    case 'r':
                    case 'R':
                        // Reset zoom to fit all data
                        chartRef.current.timeScale().fitContent();
                        event.preventDefault();
                        break;
                    case 'f':
                    case 'F':
                        // Fit to recent data (last 30%)
                        if (data.length > 0) {
                            const startIndex = Math.max(0, Math.floor(data.length * 0.7));
                            const startTime = data[startIndex].time;
                            const endTime = data[data.length - 1].time;

                            chartRef.current.timeScale().setVisibleRange({
                                from: startTime,
                                to: endTime,
                            });
                        }
                        event.preventDefault();
                        break;
                }
            };

            // Add event listeners
            window.addEventListener("keydown", handleKeyDown);
            window.addEventListener("resize", handleResize);
            handleResize();

        } catch (error) {
            console.error("Chart initialization failed:", error);
        }

        return () => {
            if (handleKeyDown) {
                window.removeEventListener("keydown", handleKeyDown);
            }
            if (handleResize) {
                window.removeEventListener("resize", handleResize);
            }
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
                priceLineRef.current = null;
            }
        };
    }, [data, colour, onTargetPriceChange]);

    // Update target price line
    useEffect(() => {
        if (!seriesRef.current) return;

        try {
            // Remove existing price line
            if (priceLineRef.current) {
                seriesRef.current.removePriceLine(priceLineRef.current);
                priceLineRef.current = null;
            }

            // Add new price line if valid price
            const price = parseFloat(targetPrice);
            if (!isNaN(price) && price > 0) {
                priceLineRef.current = seriesRef.current.createPriceLine({
                    price,
                    color: "#f97316",
                    lineWidth: 2,
                    lineStyle: LineStyle.Solid,
                    axisLabelVisible: true,
                    title: "Target",
                });
            }
        } catch (error) {
            console.warn("Failed to update price line:", error);
        }
    }, [targetPrice]);

    // Load data on mount and when dependencies change
    useEffect(() => {
        loadChart();
    }, [loadChart]);

    if (loading) return <ChartSkeleton />;
    if (error) return <ChartError error={error} onRetry={loadChart} />;
    if (!data || data.length === 0) return <EmptyChart token={token} />;

    return <div ref={containerRef} className="w-full h-[220px]" />;
} 