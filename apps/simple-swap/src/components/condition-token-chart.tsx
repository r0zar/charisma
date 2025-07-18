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
    type ChartDataPoint
} from "@/lib/chart-data-utils";
import { usePrices } from '@/contexts/token-price-context';
import { useWallet } from '@/contexts/wallet-context';
import { usePriceSeriesService } from '@/lib/charts/price-series-service';
import { perfMonitor } from '@/lib/performance-monitor';

interface Props {
    token: TokenCacheData;
    baseToken?: TokenCacheData | null;
    targetPrice: string;
    direction?: 'lt' | 'gt';
    onTargetPriceChange: (price: string) => void;
    colour?: string;
}

// Convert LineData to ChartDataPoint format - detect time format automatically
function convertToChartDataPoint(data: LineData[]): ChartDataPoint[] {
    return data.map(point => {
        const timeValue = Number(point.time);
        // Detect if time is already in milliseconds (> year 2000 in seconds = 946684800)
        // If it's a large number, it's likely milliseconds; if small, it's seconds
        const isMilliseconds = timeValue > 946684800000;
        return {
            time: isMilliseconds ? timeValue : timeValue * 1000,
            value: point.value
        };
    });
}

// Convert ChartDataPoint back to LineData format - lightweight-charts expects seconds
function convertToLineData(data: ChartDataPoint[]): LineData[] {
    return data.map(point => ({
        time: Math.floor(point.time / 1000) as any, // Always convert to seconds for lightweight-charts
        value: point.value
    }));
}

function formatPrice(price: number): string {
    if (price === 0) return '0';
    if (isNaN(price)) return '0';

    // Use 4-5 significant digits, but ensure we show meaningful precision
    const magnitude = Math.floor(Math.log10(Math.abs(price)));

    if (price >= 1) {
        // For values >= 1, show 2-4 decimal places max
        return price.toFixed(Math.min(4, Math.max(2, 4 - magnitude)));
    } else {
        // For values < 1, ensure we show at least 4 significant digits
        const significantDigits = 4;
        const decimalPlaces = significantDigits - magnitude - 1;
        return price.toFixed(Math.min(8, Math.max(2, decimalPlaces)));
    }
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
    direction = 'gt',
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
    const { getPrice } = usePrices();
    const priceSeriesService = usePriceSeriesService();

    // For subnet tokens, use their base token's price for real-time updates
    const getTokenPriceFromFeed = useCallback((tokenData: TokenCacheData) => {
        // If it's a subnet token, use the base token's price
        if (tokenData.type === 'SUBNET' && tokenData.base) {
            return getPrice(tokenData.base);
        }
        // Otherwise use the token's own price
        return getPrice(tokenData.contractId);
    }, [getPrice]);

    const currentTokenPrice = getTokenPriceFromFeed(token);
    const currentBasePrice = baseToken ? getTokenPriceFromFeed(baseToken) : null;


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
                // For single token data, apply resilience if needed (match token chart exactly)
                const tokenChartData = convertToChartDataPoint(tokenData);
                const enhancedData = enhanceSparseTokenData(tokenChartData, undefined, 15); // Match token chart
                processedData = convertToLineData(enhancedData);
            }

            const validData = processedData.filter((point): point is LineData => isValidDataPoint({
                time: Number(point.time),
                value: point.value
            }));

            // Sort by time and remove duplicates (required by lightweight-charts)
            const sortedData = validData.sort((a, b) => Number(a.time) - Number(b.time));
            const deduplicatedData = sortedData.filter((point, index) => {
                if (index === 0) return true;
                return Number(point.time) !== Number(sortedData[index - 1].time);
            });

            setData(deduplicatedData);

            timer.end({
                success: true,
                dataPoints: deduplicatedData.length,
                hasBaseToken: !!baseToken?.contractId,
                tokenId: token.contractId.substring(0, 10)
            });

            console.log('[CONDITION-CHART] Data loaded successfully:', {
                token: token.symbol,
                baseToken: baseToken?.symbol || null,
                mode: baseToken ? 'ratio' : 'single',
                originalPoints: validData.length,
                finalPoints: deduplicatedData.length,
                duplicatesRemoved: validData.length - deduplicatedData.length
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

    // Effect to handle price updates from token price context
    useEffect(() => {
        console.log('[REAL-TIME] Price update triggered:', {
            token: token.symbol,
            baseToken: baseToken?.symbol || null,
            hasSeriesRef: !!seriesRef.current,
            currentTokenPrice,
            currentBasePrice,
            lastTokenPrice: lastPricesRef.current.token,
            lastBasePrice: lastPricesRef.current.base
        });

        if (!seriesRef.current) {
            console.log('[REAL-TIME] No series ref, skipping update');
            return;
        }

        // Extract price values from price objects
        const tokenPriceValue = currentTokenPrice;
        const basePriceValue = currentBasePrice;

        // Check if prices have actually changed (similar to token chart pattern)
        const hasTokenPriceChanged = lastPricesRef.current.token !== tokenPriceValue;
        const hasBasePriceChanged = lastPricesRef.current.base !== basePriceValue;

        console.log('[REAL-TIME] Price change analysis:', {
            hasTokenPriceChanged,
            hasBasePriceChanged,
            tokenChange: hasTokenPriceChanged ? `${lastPricesRef.current.token} → ${tokenPriceValue}` : 'no change',
            baseChange: hasBasePriceChanged ? `${lastPricesRef.current.base} → ${basePriceValue}` : 'no change',
            tokenPriceObject: currentTokenPrice,
            basePriceObject: currentBasePrice
        });

        if (!hasTokenPriceChanged && !hasBasePriceChanged) {
            console.log('[REAL-TIME] No price changes detected, skipping update');
            return;
        }

        if (!tokenPriceValue || typeof tokenPriceValue !== 'number' || tokenPriceValue <= 0) {
            console.log('[REAL-TIME] Invalid token price, skipping update:', {
                tokenPriceValue,
                currentTokenPrice,
                isNumber: typeof tokenPriceValue === 'number',
                isPositive: (tokenPriceValue as number) > 0
            });
            return;
        }

        const now = Math.floor(Date.now() / 1000); // Convert to seconds for lightweight-charts
        let newPrice = tokenPriceValue;

        // If we have a base token, calculate the ratio
        if (baseToken && basePriceValue && typeof basePriceValue === 'number' && basePriceValue > 0) {
            const oldPrice = newPrice;
            newPrice = tokenPriceValue / basePriceValue;
            console.log('[REAL-TIME] Ratio calculation:', {
                tokenPrice: tokenPriceValue,
                basePrice: basePriceValue,
                calculatedRatio: newPrice,
                ratioChange: `${oldPrice.toFixed(6)} → ${newPrice.toFixed(6)}`
            });
        } else if (baseToken) {
            console.log('[REAL-TIME] Base token mode but invalid base price:', {
                baseToken: baseToken.symbol,
                basePriceValue,
                currentBasePrice,
                isNumber: typeof basePriceValue === 'number',
                isPositive: basePriceValue ? (basePriceValue as number) > 0 : false
            });
        } else {
            console.log('[REAL-TIME] Single token mode, using raw price:', {
                rawPrice: tokenPriceValue
            });
        }

        try {
            console.log('[REAL-TIME] Updating chart with:', {
                time: now,
                value: newPrice,
                formattedValue: newPrice.toFixed(8),
                timestamp: new Date(now * 1000).toISOString()
            });

            // Use the update API to add the new data point (same as token chart)
            seriesRef.current.update({
                time: now as any,
                value: newPrice
            });

            // Update our refs
            lastPricesRef.current = {
                token: tokenPriceValue as number,
                base: basePriceValue as number | null
            };
            setLastUpdateTime(now);

            console.log('[REAL-TIME] Chart update successful:', {
                newPrice: newPrice.toFixed(6),
                timestamp: now,
                mode: baseToken ? 'ratio' : 'single'
            });
        } catch (error) {
            console.error('[REAL-TIME] Chart update failed:', {
                error: error instanceof Error ? error.message : error,
                time: now,
                value: newPrice,
                seriesExists: !!seriesRef.current
            });
        }
    }, [currentTokenPrice, currentBasePrice, baseToken, token.symbol]);

    // Initialize chart when container and data are ready
    useEffect(() => {
        if (!containerRef.current || !data || data.length === 0) {
            return;
        }

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
                    shiftVisibleRangeOnNewBar: false, // Don't auto-follow to allow free zoom
                    allowShiftVisibleRangeOnWhitespaceReplacement: true, // Allow clicking to move
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

            // Set initial view to show all data without restrictions
            setTimeout(() => {
                if (chartRef.current && data.length > 0) {
                    // First reset any potential range locks
                    chartRef.current.timeScale().resetTimeScale();
                    // Then fit all content
                    chartRef.current.timeScale().fitContent();
                }
            }, 100);

            // Handle clicks
            const handleClick = (param: any) => {
                if (!param.point || !seriesRef.current) return;
                const price = seriesRef.current.coordinateToPrice(param.point.y);
                if (price && !isNaN(price)) {
                    // Use toString() to avoid scientific notation from toPrecision()
                    onTargetPriceChange(price.toString());
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
                    case 'z':
                    case 'Z':
                        // Force unlock zoom by resetting visible range to full data
                        if (data.length > 0) {
                            chartRef.current.timeScale().setVisibleRange({
                                from: data[0].time,
                                to: data[data.length - 1].time,
                            });
                            // Then immediately fit content to allow free zooming
                            setTimeout(() => {
                                if (chartRef.current) {
                                    chartRef.current.timeScale().fitContent();
                                }
                            }, 10);
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
                const directionSymbol = direction === 'gt' ? '≥' : '≤';
                priceLineRef.current = seriesRef.current.createPriceLine({
                    price,
                    color: "#f97316",
                    lineWidth: 2,
                    lineStyle: LineStyle.Solid,
                    axisLabelVisible: true,
                    title: `Target ${directionSymbol}`,
                });
            }
        } catch (error) {
            console.warn("Failed to update price line:", error);
        }
    }, [targetPrice, direction]);

    // Load data on mount and when dependencies change
    useEffect(() => {
        loadChart();
    }, [loadChart]);

    if (loading) return <ChartSkeleton />;
    if (error) return <ChartError error={error} onRetry={loadChart} />;
    if (!data || data.length === 0) return <EmptyChart token={token} />;

    return <div ref={containerRef} className="w-full h-[220px]" />;
} 