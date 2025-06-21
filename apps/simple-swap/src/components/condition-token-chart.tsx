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
import { 
    calculateResilientRatioData, 
    enhanceSparseTokenData, 
    isValidDataPoint,
    getDefaultTimeRange,
    type ChartDataPoint 
} from "@/lib/chart-data-utils";
import { useBlaze } from 'blaze-sdk/realtime';
import { useWallet } from '@/contexts/wallet-context';
import { usePriceSeriesService } from '@/lib/price-series-service';
import { perfMonitor } from '@/lib/performance-monitor';

interface Props {
    token: TokenCacheData;
    baseToken?: TokenCacheData | null;
    targetPrice: string;
    onTargetPriceChange: (price: string) => void;
    colour?: string;
}

// Convert LineData to ChartDataPoint format
function convertToChartDataPoint(data: LineData[]): ChartDataPoint[] {
    return data.map(point => ({
        time: Number(point.time),
        value: point.value
    }));
}

// Convert ChartDataPoint back to LineData format
function convertToLineData(data: ChartDataPoint[]): LineData[] {
    return data.map(point => ({
        time: point.time as any,
        value: point.value
    }));
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
        <div className="w-full h-[220px] bg-white/[0.03] border border-white/[0.08] rounded-lg flex flex-col items-center justify-center space-y-2">
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
    const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

    // Real-time price data
    const { address } = useWallet();
    const { prices } = useBlaze({ userId: address });
    const priceSeriesService = usePriceSeriesService();
    const currentTokenPrice = prices[token?.contractId ?? ''];
    const currentBasePrice = baseToken ? prices[baseToken.contractId ?? ''] : null;

    // Ref to track last prices to avoid duplicate updates
    const lastPricesRef = useRef<{ token: number | null, base: number | null }>({ token: null, base: null });

    // Fetch data and initialize chart
    const loadChart = useCallback(async () => {
        if (!token?.contractId) return;

        const timer = perfMonitor.startTiming('condition-chart-load-data');
        setLoading(true);
        setError(null);

        try {
            // Use bulk fetching for efficiency
            const contractIds = baseToken?.contractId 
                ? [token.contractId, baseToken.contractId]
                : [token.contractId];

            const bulkData = await priceSeriesService.fetchBulkPriceSeries(contractIds);
            const tokenData = bulkData[token.contractId] || [];

            if (!Array.isArray(tokenData)) {
                throw new Error("Invalid price data format");
            }

            let processedData = tokenData;

            // Process ratio data if base token exists
            if (baseToken?.contractId && bulkData[baseToken.contractId]) {
                const baseData = bulkData[baseToken.contractId];
                if (Array.isArray(baseData)) {
                    // Convert to ChartDataPoint format and use resilient ratio calculation
                    const tokenChartData = convertToChartDataPoint(tokenData);
                    const baseChartData = convertToChartDataPoint(baseData);
                    
                    const ratioChartData = calculateResilientRatioData(tokenChartData, baseChartData, {
                        minPoints: 15, // Match token chart for better extrapolation
                        defaultTimeRangeMs: 30 * 24 * 60 * 60 * 1000 // 30 days
                    });
                    processedData = convertToLineData(ratioChartData);
                }
            } else {
                // For single token data, apply resilience if needed
                const tokenChartData = convertToChartDataPoint(tokenData);
                const enhancedData = enhanceSparseTokenData(tokenChartData, getDefaultTimeRange(), 15); // Match token chart
                processedData = convertToLineData(enhancedData);
            }

            const validData = processedData.filter((point): point is LineData => isValidDataPoint({
                time: Number(point.time),
                value: point.value
            }));
            setData(validData);

            timer.end({ 
                success: true, 
                dataPoints: validData.length,
                hasBaseToken: !!baseToken?.contractId,
                tokenId: token.contractId.substring(0, 10)
            });

            console.log('[CONDITION-CHART] Data loaded successfully:', {
                points: validData.length,
                hasBaseToken: !!baseToken?.contractId,
                tokenId: token.contractId.substring(0, 10)
            });

        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load chart data";
            timer.end({ success: false, error: message });
            console.error('[CONDITION-CHART] Failed to load data:', err);
            setError(message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [token.contractId, baseToken?.contractId, priceSeriesService]);

    // Effect to handle real-time price updates from useBlaze - improved to match token chart
    useEffect(() => {
        if (!seriesRef.current) return;

        // Check if prices have actually changed (similar to token chart pattern)
        const hasTokenPriceChanged = lastPricesRef.current.token !== currentTokenPrice;
        const hasBasePriceChanged = lastPricesRef.current.base !== currentBasePrice;
        
        if (!hasTokenPriceChanged && !hasBasePriceChanged) return;
        if (!currentTokenPrice || currentTokenPrice <= 0) return;

        const now = Math.floor(Date.now() / 1000); // Convert to seconds for lightweight-charts
        let newPrice = currentTokenPrice;

        // If we have a base token, calculate the ratio
        if (baseToken && currentBasePrice && currentBasePrice > 0) {
            newPrice = currentTokenPrice / currentBasePrice;
        }

        try {
            // Use the update API to add the new data point (same as token chart)
            seriesRef.current.update({
                time: now as any,
                value: newPrice
            });

            // Update our refs
            lastPricesRef.current = { token: currentTokenPrice, base: currentBasePrice };
            setLastUpdateTime(now);
            
            console.log(`[CONDITION-CHART] Real-time update: ${newPrice.toFixed(6)} at ${now}`);
        } catch (error) {
            console.warn('[CONDITION-CHART] Failed to update real-time price:', error);
        }
    }, [currentTokenPrice, currentBasePrice, baseToken]);

    // Initialize chart when container and data are ready
    useEffect(() => {
        if (!containerRef.current || !data || data.length === 0) return;

        let handleKeyDown: ((event: KeyboardEvent) => void) | null = null;
        let handleResize: (() => void) | null = null;

        const chartTimer = perfMonitor.startTiming('condition-chart-initialization');
        
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
                    fixLeftEdge: false, // Allow showing recent data like token chart
                    fixRightEdge: false, // Allow flexible zoom like token chart
                    lockVisibleTimeRangeOnResize: false,
                    rightBarStaysOnScroll: false,
                    shiftVisibleRangeOnNewBar: true, // Follow new data like token chart
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

            // Set initial visible range to show recent data, similar to token chart
            const recentStartIndex = Math.max(0, data.length - Math.floor(data.length * 0.6));
            const recentStartTime = data[recentStartIndex].time;
            const lastTime = data[data.length - 1].time;

            // Set initial visible range to recent data without restrictive boundaries
            setTimeout(() => {
                if (chartRef.current) {
                    chartRef.current.timeScale().setVisibleRange({
                        from: recentStartTime,
                        to: lastTime,
                    });
                }
            }, 100); // Small delay like token chart

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

            chartTimer.end({ success: true, dataPoints: data.length });
            console.log('[CONDITION-CHART] Chart initialized successfully');

        } catch (error) {
            chartTimer.end({ success: false, error: String(error) });
            console.error('[CONDITION-CHART] Chart initialization failed:', error);
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