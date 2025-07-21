"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../ui/button';
import {
    TrendingDown,
    Activity
} from 'lucide-react';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import type { LimitOrder } from '../../lib/orders/types';
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    type CandlestickData,
    LineSeries,
    CandlestickSeries,
    ColorType,
    type IPriceLine,
    LineStyle,
} from "lightweight-charts";
import SandwichPreviewOverlay from '../pro-mode/SandwichPreviewOverlay';
import TargetPriceHoverOverlay from '../pro-mode/TargetPriceHoverOverlay';
import { usePriceSeriesService } from '@/lib/charts/price-series-service';
import { usePrices } from '@/contexts/token-price-context';

// Enriched order type with token metadata
interface DisplayOrder extends LimitOrder {
    inputTokenMeta: TokenCacheData;
    outputTokenMeta: TokenCacheData;
    conditionTokenMeta: TokenCacheData;
    baseAssetMeta?: TokenCacheData | null;
}

interface ProModeChartProps {
    token: TokenCacheData;
    baseToken?: TokenCacheData | null;
    targetPrice: string;
    onTargetPriceChange: (price: string) => void;
    userOrders: DisplayOrder[];
    highlightedOrderId?: string | null;
    conditionDir?: 'gt' | 'lt';
    // Sandwich mode props
    isSandwichMode?: boolean;
    sandwichBuyPrice?: string;
    sandwichSellPrice?: string;
    onSandwichBuyPriceChange?: (price: string) => void;
    onSandwichSellPriceChange?: (price: string) => void;
    sandwichSpread?: string;
    // Perpetual mode props
    isPerpetualMode?: boolean;
    perpetualDirection?: 'long' | 'short';
    perpetualEntryPrice?: string;
    perpetualStopLoss?: string;
    perpetualTakeProfit?: string;
    perpetualChartState?: any; // Will be typed properly
    onPerpetualChartClick?: (price: number) => void;
    // Current price callback
    onCurrentPriceChange?: (price: number | null) => void;
    chartType?: 'line' | 'candles';
    candleInterval?: string;
}

const ProModeChart = React.memo(function ProModeChart({
    token,
    baseToken,
    targetPrice,
    onTargetPriceChange,
    userOrders,
    highlightedOrderId,
    conditionDir = 'gt',
    isSandwichMode,
    sandwichBuyPrice,
    sandwichSellPrice,
    onSandwichBuyPriceChange,
    onSandwichSellPriceChange,
    sandwichSpread,
    isPerpetualMode,
    perpetualDirection = 'long',
    perpetualEntryPrice,
    perpetualStopLoss,
    perpetualTakeProfit,
    perpetualChartState,
    onPerpetualChartClick,
    onCurrentPriceChange,
    chartType = 'line',
    candleInterval = '4h'
}: ProModeChartProps) {
    // Access real-time price data from context
    const { getPrice } = usePrices();
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<any>(null);
    const priceLineRef = useRef<IPriceLine | null>(null);
    const targetAreaRef = useRef<ISeriesApi<'Area'> | null>(null);
    const orderLinesRef = useRef<IPriceLine[]>([]);

    const [selectedTimeframe, setSelectedTimeframe] = useState('4d');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<LineData[] | null>(null);

    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange, setPriceChange] = useState<{ value: number; percentage: number } | null>(null);
    const [isShowingRealTimeData, setIsShowingRealTimeData] = useState(false);

    // Store visible range to preserve user's view during data updates (useRef to avoid rerenders)
    const preservedTimeRangeRef = useRef<{ from: number; to: number } | null>(null);
    const preservedPriceRangeRef = useRef<{ from: number; to: number } | null>(null);
    const isInitialLoadRef = useRef(true);



    // Store original historic data (without real-time enhancements) for clean re-enhancement
    const historicDataRef = useRef<LineData[]>([]);

    // Store the current noisy data to avoid re-renders from noise updates
    const noisyDataRef = useRef<LineData[] | null>(null);

    // Store price momentum for more realistic simulation
    const priceMomentumRef = useRef<number>(0); // -1 to 1, represents current trend direction

    // Track structural properties to detect when full recreation is needed
    const prevStructuralProps = useRef({ chartType, candleInterval });

    // Sandwich mode state (useRef for chart objects, useState only for UI-affecting values)
    const mousePriceRef = useRef<number | null>(null);
    const [mousePrice, setMousePrice] = useState<number | null>(null); // Keep for UI updates
    const sandwichConfirmedLinesRef = useRef<{
        buyLine: IPriceLine | null;
        sellLine: IPriceLine | null;
    }>({ buyLine: null, sellLine: null });

    // Perpetual mode hover preview state (useRef to avoid rerenders)


    // Add refs to track confirmed lines more reliably
    const confirmedLinesRef = useRef<{
        buyLine: IPriceLine | null;
        sellLine: IPriceLine | null;
    }>({ buyLine: null, sellLine: null });

    // Ref to store current spread value without causing re-renders
    const currentSpreadRef = useRef<string>(sandwichSpread || '5');

    // Keep spread ref updated without causing re-renders
    useEffect(() => {
        currentSpreadRef.current = sandwichSpread || '5';
    }, [sandwichSpread]);

    // Helper function to get price from data point
    const getDataPointPrice = useCallback((dataPoint: any): number => {
        if ('value' in dataPoint) {
            return dataPoint.value; // Line data
        } else if ('close' in dataPoint) {
            return dataPoint.close; // Candlestick data
        }
        return 0;
    }, []);



    // Optimized price change calculation with debouncing and memoization
    const lastProcessedDataRef = useRef<{ latest: number; previous: number; timestamp: number } | null>(null);

    const updatePriceChange = useCallback((currentData: LineData[]) => {
        if (!currentData || currentData.length < 2) return;

        const latest = getDataPointPrice(currentData[currentData.length - 1]);
        const previous = getDataPointPrice(currentData[currentData.length - 2]);

        // Only update if values have actually changed (prevent unnecessary re-renders)
        const lastProcessed = lastProcessedDataRef.current;
        if (lastProcessed &&
            Math.abs(lastProcessed.latest - latest) < 0.00000001 &&
            Math.abs(lastProcessed.previous - previous) < 0.00000001) {
            return; // Values haven't changed significantly
        }

        const change = latest - previous;
        const percentage = (change / previous) * 100;

        // Store the processed values
        lastProcessedDataRef.current = { latest, previous, timestamp: Date.now() };

        console.log(`💰 Current price updated: ${latest.toFixed(8)} (change: ${change > 0 ? '+' : ''}${change.toFixed(8)}, ${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%)`);

        setCurrentPrice(latest);
        setPriceChange({ value: change, percentage });

        // Notify parent component of current price change
        if (onCurrentPriceChange) {
            onCurrentPriceChange(latest);
        }
    }, [getDataPointPrice, onCurrentPriceChange]);

    // Debounced effect for price change calculation
    useEffect(() => {
        const currentData = noisyDataRef.current || data;
        if (!currentData) return;

        // Debounce price updates to avoid excessive re-renders
        const timeoutId = setTimeout(() => {
            updatePriceChange(currentData);
        }, 50);

        return () => clearTimeout(timeoutId);
    }, [data, updatePriceChange]);

    // Helper function to convert interval string to minutes
    const getIntervalMinutes = useCallback((interval: string): number => {
        const unit = interval.slice(-1);
        const value = parseInt(interval.slice(0, -1));

        switch (unit) {
            case 'm': return value;
            case 'h': return value * 60;
            case 'd': return value * 60 * 24;
            case 'w': return value * 60 * 24 * 7;
            default: return 240; // Default to 4 hours
        }
    }, []);

    // Convert line data to candlestick data
    const convertToCandlestickData = useCallback((lineData: LineData[]): CandlestickData[] => {
        if (lineData.length === 0) return [];

        // Group data points by time periods based on selected interval
        const candlestickData: CandlestickData[] = [];
        const intervalMinutes = getIntervalMinutes(candleInterval);
        const intervalSeconds = intervalMinutes * 60;

        for (let i = 0; i < lineData.length; i++) {
            const currentTime = Number(lineData[i].time);
            const periodStart = Math.floor(currentTime / intervalSeconds) * intervalSeconds;

            // Find all points in this time period
            const periodPoints = lineData.filter(point => {
                const pointTime = Number(point.time);
                return pointTime >= periodStart && pointTime < periodStart + intervalSeconds;
            });

            if (periodPoints.length === 0) continue;

            // Calculate OHLC for this period
            const prices = periodPoints.map(p => p.value);
            const open = periodPoints[0].value;
            const close = periodPoints[periodPoints.length - 1].value;
            const high = Math.max(...prices);
            const low = Math.min(...prices);

            // Only add if we don't already have this period
            const existingCandle = candlestickData.find(c => Number(c.time) === periodStart);
            if (!existingCandle) {
                candlestickData.push({
                    time: periodStart as any,
                    open,
                    high,
                    low,
                    close
                });
            }
        }

        return candlestickData.sort((a, b) => Number(a.time) - Number(b.time));
    }, [candleInterval, getIntervalMinutes]);

    // Functions to preserve chart view state
    const captureVisibleRange = useCallback(() => {
        if (!chartRef.current) return;

        try {
            const timeScale = chartRef.current.timeScale();
            const priceScale = chartRef.current.priceScale('right');

            const timeRange = timeScale.getVisibleRange();
            if (timeRange) {
                preservedTimeRangeRef.current = {
                    from: Number(timeRange.from),
                    to: Number(timeRange.to)
                };
            }

            // Note: Price range preservation is more complex and depends on the chart's internal state
            // We'll primarily focus on time range which is the most important for user experience
        } catch (e) {
            console.warn('Failed to capture visible range:', e);
        }
    }, []);

    const restoreVisibleRange = useCallback(() => {
        if (!chartRef.current || !preservedTimeRangeRef.current || isInitialLoadRef.current) return;

        try {
            const timeScale = chartRef.current.timeScale();

            // Small delay to ensure chart has processed the new data
            setTimeout(() => {
                if (chartRef.current && preservedTimeRangeRef.current) {
                    timeScale.setVisibleRange({
                        from: preservedTimeRangeRef.current.from as any,
                        to: preservedTimeRangeRef.current.to as any
                    });
                }
            }, 50);
        } catch (e) {
            console.warn('Failed to restore visible range:', e);
        }
    }, []);

    // Optimized chart data update with incremental updates support
    const updateChartData = useCallback((newData: LineData[] | CandlestickData[], isRealTimeUpdate = false, incrementalPoint?: LineData) => {
        if (!seriesRef.current || !newData || newData.length === 0) return;

        try {
            // For real-time updates with a single incremental point, use update() instead of setData()
            if (isRealTimeUpdate && incrementalPoint && newData.length > 0) {
                const lastPoint = newData[newData.length - 1] as LineData;

                // Use efficient incremental update for single data points
                if (chartType === 'line') {
                    seriesRef.current.update(lastPoint);
                    console.log('📈 Incremental chart update:', {
                        time: lastPoint.time,
                        value: lastPoint.value,
                        timeFormatted: new Date(Number(lastPoint.time) * 1000).toISOString()
                    });
                } else {
                    // For candlestick charts, we still need to use setData for now
                    const candlestickData = convertToCandlestickData(newData as LineData[]);
                    seriesRef.current.setData(candlestickData);
                }

                // Auto-scroll to show new data if needed
                if (chartRef.current) {
                    const lastTime = Number(lastPoint.time);
                    const timeScale = chartRef.current.timeScale();
                    const visibleRange = timeScale.getVisibleRange();

                    if (visibleRange && lastTime > Number(visibleRange.to)) {
                        const rangeSize = Number(visibleRange.to) - Number(visibleRange.from);
                        const newTo = lastTime + (rangeSize * 0.05); // Smaller padding for smoother scrolling
                        const newFrom = newTo - rangeSize;

                        timeScale.setVisibleRange({
                            from: newFrom as any,
                            to: newTo as any
                        });
                    }
                }
                return;
            }

            // For bulk updates, preserve view unless it's real-time
            if (!isRealTimeUpdate) {
                captureVisibleRange();
            }

            // Bulk data update (used for initial load and major refreshes)
            if (chartType === 'candles') {
                const candlestickData = convertToCandlestickData(newData as LineData[]);
                // Sort by time and remove duplicates (required by lightweight-charts)
                const sortedCandleData = candlestickData.sort((a, b) => Number(a.time) - Number(b.time));
                const deduplicatedCandleData = sortedCandleData.filter((point, index) => {
                    if (index === 0) return true;
                    return Number(point.time) !== Number(sortedCandleData[index - 1].time);
                });
                seriesRef.current.setData(deduplicatedCandleData);
            } else {
                // Sort by time and remove duplicates (required by lightweight-charts)
                const sortedData = (newData as LineData[]).sort((a, b) => Number(a.time) - Number(b.time));
                const deduplicatedData = sortedData.filter((point, index) => {
                    if (index === 0) return true;
                    return Number(point.time) !== Number(sortedData[index - 1].time);
                });
                seriesRef.current.setData(deduplicatedData);
            }

            // Restore view for non-real-time bulk updates
            if (!isRealTimeUpdate) {
                restoreVisibleRange();
            }
        } catch (e) {
            console.warn('Failed to update chart data:', e);
        }
    }, [chartType, convertToCandlestickData, captureVisibleRange, restoreVisibleRange]);

    // Optimized function to get current real-time price for incremental updates
    const getCurrentRealTimePrice = useCallback((tokenToPrice: TokenCacheData, baseTokenToPrice?: TokenCacheData | null): { price: number | null; point: LineData | null } => {
        // Get real-time prices
        let currentTokenPrice = getPrice(tokenToPrice.contractId);
        let currentBasePrice: number | undefined;

        // Handle subnet tokens - fallback to base token price
        if (!currentTokenPrice && tokenToPrice.type === 'SUBNET' && tokenToPrice.base) {
            currentTokenPrice = getPrice(tokenToPrice.base);
        }

        if (baseTokenToPrice?.contractId) {
            currentBasePrice = getPrice(baseTokenToPrice.contractId) || undefined;
            // Handle subnet tokens for base
            if (!currentBasePrice && baseTokenToPrice.type === 'SUBNET' && baseTokenToPrice.base) {
                currentBasePrice = getPrice(baseTokenToPrice.base) || undefined;
            }
        }

        // Calculate current price (ratio or direct)
        let realTimePrice: number | undefined;
        if (baseTokenToPrice && currentTokenPrice && currentBasePrice) {
            realTimePrice = currentBasePrice / currentTokenPrice;
        } else if (currentTokenPrice) {
            realTimePrice = currentTokenPrice;
        }

        // Return null if no valid price
        if (!realTimePrice || !isFinite(realTimePrice) || realTimePrice <= 0) {
            return { price: null, point: null };
        }

        const now = Math.floor(Date.now() / 1000);
        return {
            price: realTimePrice,
            point: {
                time: now as any,
                value: realTimePrice
            }
        };
    }, [getPrice]);

    // Function to enhance historic data with real-time price (used for full refreshes)
    const enhanceWithRealTimePrice = useCallback((historicData: LineData[], tokenToPrice: TokenCacheData, baseTokenToPrice?: TokenCacheData | null): LineData[] => {
        if (!historicData || historicData.length === 0) return [];

        const realTimeData = getCurrentRealTimePrice(tokenToPrice, baseTokenToPrice);

        if (!realTimeData.price || !realTimeData.point) {
            console.warn('No valid real-time price available, using historic data only');
            setIsShowingRealTimeData(false);
            return [...historicData];
        }

        console.log('🔍 Real-time price enhancement:', {
            token: tokenToPrice.symbol,
            baseToken: baseTokenToPrice?.symbol || 'USD',
            price: realTimeData.price.toFixed(8)
        });

        // Create enhanced data array (minimize array operations)
        const enhancedData = historicData.slice(); // Shallow copy
        const now = Number(realTimeData.point.time);

        // Check if the last data point is recent (within last 5 minutes)
        const lastHistoricPoint = enhancedData[enhancedData.length - 1];
        const lastHistoricTime = Number(lastHistoricPoint.time);
        const timeDiffMinutes = (now - lastHistoricTime) / 60;

        if (timeDiffMinutes < 5) {
            // Replace the last historic point with real-time data
            enhancedData[enhancedData.length - 1] = realTimeData.point;
            console.log(`🔄 Updated last data point with real-time price: $${realTimeData.price.toFixed(8)}`);
        } else {
            // Append a new real-time data point
            enhancedData.push(realTimeData.point);
            console.log(`📈 Appended real-time data point: $${realTimeData.price.toFixed(8)}`);
        }

        // Indicate that we're now showing real-time data
        setIsShowingRealTimeData(true);

        return enhancedData;
    }, [getCurrentRealTimePrice]);

    // Store latest refs to avoid dependency issues
    const latestTokenRef = useRef(token);
    const latestBaseTokenRef = useRef(baseToken);
    const latestOnCurrentPriceChangeRef = useRef(onCurrentPriceChange);

    latestTokenRef.current = token;
    latestBaseTokenRef.current = baseToken;
    latestOnCurrentPriceChangeRef.current = onCurrentPriceChange;

    // Fetch chart data and enhance with real-time price
    const priceSeriesService = usePriceSeriesService();

    const loadChart = useCallback(async () => {
        if (!token?.contractId) return;

        setLoading(true);
        setError(null);

        try {
            // Use bulk fetching service for efficiency
            const contractIds = baseToken?.contractId
                ? [token.contractId, baseToken.contractId]
                : [token.contractId];

            const bulkData = await priceSeriesService.fetchBulkPriceSeries(contractIds);
            const tokenData = bulkData[token.contractId] || [];
            let processedData = tokenData;

            if (baseToken?.contractId && bulkData[baseToken.contractId]) {
                const baseData = bulkData[baseToken.contractId];
                if (Array.isArray(baseData)) {
                    processedData = calculateRatioData(tokenData, baseData);
                }
            }

            const validData = processedData.filter(isValidDataPoint);

            // Store original historic data for future real-time enhancements
            historicDataRef.current = validData;

            // Clear any existing noisy data and reset momentum when loading fresh data
            noisyDataRef.current = null;
            priceMomentumRef.current = 0;

            // Enhance with real-time price data
            const enhancedData = enhanceWithRealTimePrice(validData, token, baseToken);
            setData(enhancedData);

        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load chart data";
            setError(message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [token.contractId, baseToken?.contractId, selectedTimeframe, priceSeriesService]); // Removed enhanceWithRealTimePrice from deps

    // Memoized data reference to prevent unnecessary updates
    const memoizedData = useMemo(() => {
        if (!data || data.length === 0) return null;

        // Create a stable reference based on data length and first/last values
        const key = `${data.length}-${data[0]?.time}-${data[data.length - 1]?.time}-${data[data.length - 1]?.value}`;
        return { data, key };
    }, [data]);

    // Optimized effect for data-only updates (preserves chart view)
    useEffect(() => {
        if (!memoizedData) return;

        // If chart doesn't exist yet, let the chart initialization effect handle it
        if (!chartRef.current || !seriesRef.current) return;

        // Only update data if chart already exists (not initial creation)
        if (!isInitialLoadRef.current) {
            console.log('📊 Updating chart data without recreation (preserving view)');
            updateChartData(memoizedData.data, false); // Not a real-time update, preserve view
        } else {
            console.log('📊 Skipping data-only update - waiting for chart initialization');
        }
    }, [memoizedData, updateChartData]);



    // Memoized structural properties to prevent unnecessary chart recreations
    const structuralProps = useMemo(() => ({
        chartType,
        candleInterval,
        containerWidth: containerRef.current?.getBoundingClientRect().width || 0,
        containerHeight: containerRef.current?.getBoundingClientRect().height || 0
    }), [chartType, candleInterval]);

    // Initialize chart (only when structure changes, not data)
    useEffect(() => {
        if (!containerRef.current || !data || data.length === 0) return;

        // Check if only data changed (no structural changes)
        const structuralChanged =
            prevStructuralProps.current.chartType !== structuralProps.chartType ||
            prevStructuralProps.current.candleInterval !== structuralProps.candleInterval;

        // If chart exists and only data changed, let the data-only effect handle it
        if (chartRef.current && seriesRef.current && !structuralChanged && !isInitialLoadRef.current) {
            console.log('📊 Skipping chart recreation - only data changed');
            return;
        }

        console.log('🔄 Recreating chart due to structural changes or initial load');

        // Update tracked structural properties
        prevStructuralProps.current = { chartType: structuralProps.chartType, candleInterval: structuralProps.candleInterval };

        // Clean up existing chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
            priceLineRef.current = null;
            targetAreaRef.current = null;
            orderLinesRef.current = [];
            // Clean up manual grid lines
            if ((window as any).manualGridLines) {
                (window as any).manualGridLines = [];
            }
        }

        try {
            const rect = containerRef.current.getBoundingClientRect();

            chartRef.current = createChart(containerRef.current, {
                width: rect.width,
                height: rect.height,
                layout: {
                    background: { type: ColorType.Solid, color: "transparent" },
                    textColor: "#d1d5db",
                    fontSize: 12,
                },
                localization: {
                    priceFormatter: (price: number) => {
                        // For very small numbers, show up to 10 decimal places
                        if (price < 0.001) {
                            return price.toFixed(10);
                        }
                        // For small numbers, show 8 decimal places
                        else if (price < 1) {
                            return price.toFixed(8);
                        }
                        // For larger numbers, show 6 decimal places
                        else if (price < 1000) {
                            return price.toFixed(6);
                        }
                        // For very large numbers, show 2 decimal places
                        else {
                            return price.toFixed(2);
                        }
                    },
                    timeFormatter: (time: number) => {
                        // Convert Unix timestamp to local time
                        const date = new Date(time * 1000);

                        // Format based on time range for better readability
                        const now = new Date();
                        const diffDays = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

                        if (diffDays < 1) {
                            // Less than 1 day: show time only (e.g., "14:30")
                            return date.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            });
                        } else if (diffDays < 7) {
                            // Less than 1 week: show day and time (e.g., "Mon 14:30")
                            return date.toLocaleDateString([], {
                                weekday: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            });
                        } else {
                            // More than 1 week: show date (e.g., "Dec 25")
                            return date.toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric'
                            });
                        }
                    }
                },
                grid: {
                    vertLines: {
                        color: "rgba(156, 163, 175, 0.4)",
                        style: LineStyle.Solid,
                        visible: true,
                    },
                    horzLines: {
                        color: "rgba(156, 163, 175, 0.8)",
                        style: LineStyle.Solid,
                        visible: true,
                    },
                },
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                    borderVisible: false,
                    rightOffset: 12,
                    barSpacing: 3,
                    minBarSpacing: 0.001,
                    fixLeftEdge: false,
                    fixRightEdge: false,
                    lockVisibleTimeRangeOnResize: false,
                    rightBarStaysOnScroll: false, // Allow normal zoom behavior centered on cursor
                    shiftVisibleRangeOnNewBar: false, // Don't automatically shift when new data arrives
                    minimumHeight: 0,
                },
                leftPriceScale: {
                    visible: false,
                    borderVisible: false,
                    scaleMargins: { top: 0.2, bottom: 0.2 },
                },
                rightPriceScale: {
                    visible: true,
                    borderVisible: true,
                    scaleMargins: { top: 0.2, bottom: 0.2 },
                    autoScale: true,
                    mode: 0, // Normal mode instead of logarithmic for better grid lines
                    invertScale: false,
                    alignLabels: true,
                    borderColor: "#374151",
                    textColor: "#d1d5db",
                    entireTextOnly: false,
                    ticksVisible: true,
                    minimumWidth: 75,
                },
                crosshair: {
                    mode: 0, // Normal crosshair mode
                    vertLine: {
                        width: 1,
                        color: '#758694',
                        style: LineStyle.Dashed,
                    },
                    horzLine: {
                        width: 1,
                        color: '#758694',
                        style: LineStyle.Dashed,
                    },
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

            // Create series based on chart type
            if (chartType === 'candles') {
                const candlestickData = convertToCandlestickData(data);
                // Sort by time and remove duplicates (required by lightweight-charts)
                const sortedCandleData = candlestickData.sort((a, b) => Number(a.time) - Number(b.time));
                const deduplicatedCandleData = sortedCandleData.filter((point, index) => {
                    if (index === 0) return true;
                    return Number(point.time) !== Number(sortedCandleData[index - 1].time);
                });
                seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
                    upColor: '#22c55e',
                    downColor: '#ef4444',
                    borderVisible: false,
                    wickUpColor: '#22c55e',
                    wickDownColor: '#ef4444',
                    priceLineVisible: false,
                    lastValueVisible: true,
                });
                seriesRef.current.setData(deduplicatedCandleData);
            } else {
                // Sort by time and remove duplicates (required by lightweight-charts)
                const sortedData = data.sort((a, b) => Number(a.time) - Number(b.time));
                const deduplicatedData = sortedData.filter((point, index) => {
                    if (index === 0) return true;
                    return Number(point.time) !== Number(sortedData[index - 1].time);
                });
                seriesRef.current = chartRef.current.addSeries(LineSeries, {
                    color: '#3b82f6',
                    lineWidth: 2,
                    priceLineVisible: false,
                    lastValueVisible: true,
                });
                seriesRef.current.setData(deduplicatedData);
            }

            // Mark as no longer initial load after first chart creation
            isInitialLoadRef.current = false;

            // Debug: Log data to understand the time range
            console.log('Chart data loaded:', {
                totalPoints: data.length,
                firstPoint: data[0] ? {
                    time: data[0].time,
                    date: new Date(Number(data[0].time) * 1000).toISOString(),
                    value: data[0].value
                } : null,
                lastPoint: data[data.length - 1] ? {
                    time: data[data.length - 1].time,
                    date: new Date(Number(data[data.length - 1].time) * 1000).toISOString(),
                    value: data[data.length - 1].value
                } : null,
                timeRangeHours: data.length > 0 ? (Number(data[data.length - 1].time) - Number(data[0].time)) / 3600 : 0,
                timeRangeDays: data.length > 0 ? (Number(data[data.length - 1].time) - Number(data[0].time)) / (3600 * 24) : 0
            });

            if (data.length > 0) {
                const prices = data.map(d => getDataPointPrice(d));
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                console.log('Price range:', { minPrice, maxPrice, range: maxPrice - minPrice });

                // Ensure minimum price is never below zero for price data
                if (minPrice < 0) {
                    console.warn('Detected negative price values, filtering out invalid data points');
                    const validPrices = prices.filter(p => p > 0);
                    if (validPrices.length === 0) {
                        console.error('All price data is invalid (negative or zero)');
                        return;
                    }
                }

                // Add manual grid lines for better y-axis visibility
                const priceRange = maxPrice - minPrice;
                const gridSpacing = priceRange / 50; // Create 50 grid lines for good balance

                for (let i = 1; i < 50; i++) {
                    const gridPrice = minPrice + (gridSpacing * i);
                    try {
                        const gridLine = seriesRef.current.createPriceLine({
                            price: gridPrice,
                            color: "rgba(156, 163, 175, 0.15)", // Slightly more visible
                            lineWidth: 1,
                            lineStyle: LineStyle.Solid,
                            axisLabelVisible: false, // Hide labels for intermediate lines to avoid clutter
                            title: '',
                        });
                        // Store grid lines for cleanup
                        if (!(window as any).manualGridLines) {
                            (window as any).manualGridLines = [];
                        }
                        (window as any).manualGridLines.push(gridLine);
                    } catch (e) {
                        console.warn('Failed to create manual grid line:', e);
                    }
                }

                // For very small price ranges, force a minimum visible range
                const range = maxPrice - minPrice;
                if (range < maxPrice * 0.05) {
                    // Force the chart to show at least 5% range around the price
                    const center = (minPrice + maxPrice) / 2;
                    const minRange = center * 0.1; // 10% total range
                    const newMin = center - minRange / 2;
                    const newMax = center + minRange / 2;

                    // Apply the range after a short delay to ensure chart is ready
                    setTimeout(() => {
                        if (chartRef.current && seriesRef.current) {
                            chartRef.current.priceScale('right').applyOptions({
                                scaleMargins: { top: 0.1, bottom: 0.1 },
                            });
                            // Force specific price range to generate more grid lines
                            chartRef.current.timeScale().fitContent();

                            // Try to force the price scale to show more levels
                            chartRef.current.priceScale('right').applyOptions({
                                autoScale: false,
                            });

                            // Set a specific visible range to force grid generation
                            setTimeout(() => {
                                if (chartRef.current) {
                                    chartRef.current.priceScale('right').applyOptions({
                                        autoScale: true,
                                    });
                                }
                            }, 200);
                        }
                    }, 100);
                }
            }

            // Handle clicks for setting target price
            const handleClick = (param: any) => {
                if (!param.point || !seriesRef.current) return;
                const price = seriesRef.current.coordinateToPrice(param.point.y);
                if (price && !isNaN(price)) {
                    if (isSandwichMode) {
                        // In sandwich mode, set both buy and sell prices based on current mouse position
                        const priceStr = price.toPrecision(9);
                        if (onSandwichBuyPriceChange && onSandwichSellPriceChange) {
                            // Calculate buy and sell prices using dynamic spread from ref
                            const spreadPercent = parseFloat(currentSpreadRef.current) / 100; // Use ref value
                            const buyPrice = price * (1 - spreadPercent);
                            const sellPrice = price * (1 + spreadPercent);
                            onSandwichBuyPriceChange(buyPrice.toPrecision(9));
                            onSandwichSellPriceChange(sellPrice.toPrecision(9));

                            // Create confirmed lines
                            createSandwichConfirmedLines(buyPrice, sellPrice);
                        }
                    } else if (isPerpetualMode && onPerpetualChartClick) {
                        // Perpetual mode - handle chart interaction for entry/stop/profit
                        onPerpetualChartClick(price);
                    } else if (!isPerpetualMode) {
                        // Normal mode - single target price (for DCA and Single orders)
                        onTargetPriceChange(price.toPrecision(9));
                    }
                }
            };

            // Handle mouse move - handles hover preview for all order types
            const handleMouseMove = (param: any) => {
                if (!seriesRef.current) {
                    setMousePrice(null);
                    return;
                }

                if (!param.point) {
                    setMousePrice(null);
                    return;
                }

                const price = seriesRef.current.coordinateToPrice(param.point.y);
                if (price && !isNaN(price)) {
                    // Show hover preview for sandwich mode and also for DCA/Single when no target price is set
                    if (isSandwichMode || (!targetPrice || targetPrice === '0')) {
                        setMousePrice(price);
                    }
                } else {
                    setMousePrice(null);
                }
            };

            chartRef.current.subscribeClick(handleClick);
            chartRef.current.subscribeCrosshairMove(handleMouseMove);

            // Subscribe to visible range changes to update fade lines dynamically
            const handleVisibleRangeChange = () => {
                // Small delay to ensure chart has updated
                setTimeout(() => {
                    // Trigger re-render of fade lines by updating a dummy state
                    // This will cause the effects to run again with new visible range
                    if (targetPrice && targetPrice.trim() !== '' && targetPrice !== '0') {
                        // Force target price effect to re-run
                        const price = parseFloat(targetPrice);
                        if (!isNaN(price) && price > 0) {
                            // The effect will automatically use the new visible range
                        }
                    }
                }, 100);
            };

            // Listen for time scale changes (zoom/pan)
            chartRef.current.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

            // Store the handler for cleanup
            (window as any).visibleRangeHandler = handleVisibleRangeChange;

            // Add mouse leave handler
            const handleMouseLeave = () => {
                setMousePrice(null);
            };

            // Add mouse leave event to the container
            if (containerRef.current) {
                containerRef.current.addEventListener('mouseleave', handleMouseLeave);
            }



            // Add manual grid lines after chart is ready
            setTimeout(() => {
                addManualGridLines();

                // Fit content to show all data initially with some padding
                if (chartRef.current) {
                    chartRef.current.timeScale().fitContent();

                    // Ensure the price scale doesn't show negative values
                    if (data.length > 0) {
                        const prices = data.map(d => getDataPointPrice(d));
                        const minPrice = Math.min(...prices);
                        const maxPrice = Math.max(...prices);

                        // Force visible range to start at 0 if we have negative values
                        if (minPrice < 0) {
                            const priceScale = chartRef.current.priceScale('right');
                            priceScale.applyOptions({
                                scaleMargins: { top: 0.1, bottom: 0.1 }
                            });
                        }
                    }
                }
            }, 200);

            // Handle resize
            const handleResize = () => {
                if (containerRef.current && chartRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    chartRef.current.applyOptions({
                        width: rect.width,
                        height: rect.height
                    });
                    console.log('📊 Chart resized to:', rect.width, 'x', rect.height);
                }
            };

            // Listen for window resize and custom chart container resize events
            window.addEventListener("resize", handleResize);
            window.addEventListener("chartContainerResize", handleResize);

            // Also listen for container size changes using ResizeObserver
            let resizeObserver: ResizeObserver | null = null;
            if (containerRef.current && 'ResizeObserver' in window) {
                resizeObserver = new ResizeObserver((entries) => {
                    for (const entry of entries) {
                        if (entry.target === containerRef.current) {
                            // Debounce the resize to avoid too many updates
                            setTimeout(handleResize, 10);
                            break;
                        }
                    }
                });
                resizeObserver.observe(containerRef.current);
            }

            return () => {
                window.removeEventListener("resize", handleResize);
                window.removeEventListener("chartContainerResize", handleResize);
                // Disconnect ResizeObserver
                if (resizeObserver) {
                    resizeObserver.disconnect();
                }
                // Remove mouse leave event listener
                if (containerRef.current) {
                    containerRef.current.removeEventListener('mouseleave', handleMouseLeave);
                }
                if (chartRef.current) {
                    chartRef.current.remove();
                    chartRef.current = null;
                    seriesRef.current = null;
                    priceLineRef.current = null;
                    targetAreaRef.current = null;
                    orderLinesRef.current = [];
                    // Clean up area series
                    if ((window as any).orderAreaSeries) {
                        (window as any).orderAreaSeries = [];
                    }
                    // Clean up manual grid lines
                    if ((window as any).manualGridLines) {
                        (window as any).manualGridLines = [];
                    }
                    // Clean up sandwich lines
                    confirmedLinesRef.current = { buyLine: null, sellLine: null };
                    sandwichConfirmedLinesRef.current = { buyLine: null, sellLine: null };
                }
            };

        } catch (error) {
            console.error("Chart initialization failed:", error);
        }
    }, [data, onTargetPriceChange, isSandwichMode, onSandwichBuyPriceChange, onSandwichSellPriceChange, structuralProps]);

    // Separate effect to ensure manual grid lines persist
    useEffect(() => {
        if (!seriesRef.current || !data || data.length === 0) return;

        // Add a delay to ensure chart is ready
        const timeoutId = setTimeout(() => {
            // Clean up existing manual grid lines first
            if ((window as any).manualGridLines) {
                (window as any).manualGridLines.forEach((line: any) => {
                    try {
                        seriesRef.current?.removePriceLine(line);
                    } catch (e) {
                        // Ignore errors when removing lines
                    }
                });
                (window as any).manualGridLines = [];
            }

            // Recreate grid lines
            addManualGridLines();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [data]);

    // Separate effect to add order lines - this ensures they're added after chart creation
    useEffect(() => {
        if (!seriesRef.current || !userOrders.length) return;

        // Add a small delay to ensure chart is fully initialized
        const timeoutId = setTimeout(() => {
            addOrderLines();
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [data, userOrders, token.contractId, baseToken?.contractId, highlightedOrderId]);

    // Function to add order lines (extracted for reuse)
    const addOrderLines = useCallback(() => {
        if (!seriesRef.current) return;

        // Debug: Log what orders we received
        console.log(`=== Chart addOrderLines Debug ===`);
        console.log(`Chart token: ${token.symbol} (${token.contractId})`);
        console.log(`Base token: ${baseToken?.symbol || 'USD'} (${baseToken?.contractId || 'USD'})`);
        console.log(`Total orders received: ${userOrders.length}`);
        userOrders.forEach((order, i) => {
            console.log(`Order ${i}: ${order.inputTokenMeta.symbol} → ${order.outputTokenMeta.symbol} @ ${order.targetPrice} (${order.status})`);
        });
        console.log(`=== End Debug ===`);

        // Remove existing order lines
        orderLinesRef.current.forEach(line => {
            try {
                seriesRef.current?.removePriceLine(line);
            } catch (e) {
                // Ignore errors when removing lines
            }
        });
        orderLinesRef.current = [];

        // Clean up existing order fade lines
        if ((window as any).orderFadeLines) {
            (window as any).orderFadeLines.forEach((line: any) => {
                try {
                    seriesRef.current?.removePriceLine(line);
                } catch (e) {
                    // Ignore errors when removing lines
                }
            });
            (window as any).orderFadeLines = [];
        }

        // Clean up existing manual grid lines
        if ((window as any).manualGridLines) {
            (window as any).manualGridLines.forEach((line: any) => {
                try {
                    seriesRef.current?.removePriceLine(line);
                } catch (e) {
                    // Ignore errors when removing lines
                }
            });
            (window as any).manualGridLines = [];
        }

        // Clean up existing area series
        if ((window as any).orderAreaSeries) {
            (window as any).orderAreaSeries.forEach((areaSeries: any) => {
                try {
                    chartRef.current?.removeSeries(areaSeries);
                } catch (e) {
                    // Ignore errors when removing series
                }
            });
            (window as any).orderAreaSeries = [];
        }

        // Filter orders to only show those relevant to the current trading pair
        const relevantOrders = userOrders.filter(order => {
            // Only include open orders
            if (order.status !== 'open') {
                console.log(`Skipping order - status: ${order.status}`);
                return false;
            }

            // For now, show ALL open orders since the parent component already filters by trading pair
            // This ensures we don't double-filter and miss orders due to complex token relationships
            console.log(`Including order: ${order.inputTokenMeta.symbol} → ${order.outputTokenMeta.symbol} @ ${order.targetPrice}`);
            return true;
        });

        // If a specific order is highlighted, only show that one
        const ordersToShow = highlightedOrderId
            ? relevantOrders.filter(order => order.uuid === highlightedOrderId)
            : relevantOrders;

        console.log(`Filtering orders: ${userOrders.length} total, ${relevantOrders.length} relevant for ${token.symbol}/${baseToken?.symbol || 'USD'}${highlightedOrderId ? `, showing only highlighted order: ${highlightedOrderId}` : ', showing all relevant orders'}`);
        console.log(`Orders to show: ${ordersToShow.length}`);
        console.log(`Highlighted order ID: ${highlightedOrderId || 'none'}`);
        console.log(`Orders to show details:`, ordersToShow.map(o => `${o.uuid.slice(0, 8)} @ ${o.targetPrice}`));

        if (highlightedOrderId) {
            console.log(`🔍 HIGHLIGHT MODE: Only showing order ${highlightedOrderId.slice(0, 8)}`);
        } else {
            console.log(`📊 NORMAL MODE: Showing all ${ordersToShow.length} relevant orders`);
        }

        // Debug: Show current chart price range for comparison
        if (data && data.length > 0) {
            const chartPrices = data.map(d => getDataPointPrice(d));
            const minChartPrice = Math.min(...chartPrices);
            const maxChartPrice = Math.max(...chartPrices);
            console.log(`Chart price range: ${minChartPrice.toFixed(8)} to ${maxChartPrice.toFixed(8)}`);

            // Show order prices for comparison
            ordersToShow.forEach((order, i) => {
                console.log(`Order ${i} price: ${order.targetPrice} (${order.inputTokenMeta.symbol} → ${order.outputTokenMeta.symbol})`);
            });
        }

        // Group orders by price level to avoid overlapping lines
        const ordersByPrice = new Map<string, DisplayOrder[]>();
        ordersToShow.forEach(order => {
            const priceKey = order.targetPrice || '0';
            if (!ordersByPrice.has(priceKey)) {
                ordersByPrice.set(priceKey, []);
            }
            ordersByPrice.get(priceKey)!.push(order);
        });

        console.log(`Orders grouped by price: ${ordersByPrice.size} unique price levels`);
        ordersByPrice.forEach((orders, price) => {
            console.log(`Price ${price}: ${orders.length} orders`);
        });

        // Create aggregated order lines instead of individual ones
        ordersByPrice.forEach((orders, priceKey) => {
            try {
                const price = parseFloat(priceKey);

                if (!isNaN(price) && price > 0) {
                    // Calculate total amount and determine predominant direction
                    let totalAmount = 0;
                    let buyCount = 0;
                    let sellCount = 0;
                    let tokenSymbol = '';

                    orders.forEach(order => {
                        const amount = Number(order.amountIn) / (10 ** order.inputTokenMeta.decimals!);
                        totalAmount += amount;
                        tokenSymbol = order.inputTokenMeta.symbol;

                        if (order.direction === 'gt') {
                            buyCount++;
                        } else {
                            sellCount++;
                        }
                    });

                    // Determine predominant direction
                    const isPredominantlyBuy = buyCount >= sellCount;

                    // Format the total amount compactly
                    let formattedAmount: string;
                    if (totalAmount >= 1000000) {
                        formattedAmount = (totalAmount / 1000000).toFixed(1) + 'M';
                    } else if (totalAmount >= 1000) {
                        formattedAmount = (totalAmount / 1000).toFixed(1) + 'K';
                    } else if (totalAmount >= 1) {
                        formattedAmount = totalAmount.toFixed(2);
                    } else {
                        formattedAmount = totalAmount.toFixed(4);
                    }

                    // Create title showing aggregated info
                    let title = '';
                    if (orders.length === 1) {
                        title = `${isPredominantlyBuy ? '🟢' : '🔴'} ${formattedAmount} ${tokenSymbol}`;
                    } else {
                        title = `${isPredominantlyBuy ? '🟢' : '🔴'} ${formattedAmount} ${tokenSymbol} (${orders.length} orders)`;
                    }

                    console.log(`Creating aggregated price line at ${price}: ${title}`);

                    // Create aggregated ghost line with thicker line for multiple orders
                    const line = seriesRef.current!.createPriceLine({
                        price,
                        color: isPredominantlyBuy ? "#22c55e" : "#ef4444", // Bright green/red, fully opaque
                        lineWidth: 4, // Much thicker line
                        lineStyle: LineStyle.Solid, // Solid line instead of dashed for better visibility
                        axisLabelVisible: true,
                        title,
                    });
                    orderLinesRef.current.push(line);

                    // Create diminishing line effect to show order direction using visible range
                    if (data && data.length > 0) {
                        const visibleRange = getVisiblePriceRange();
                        if (!visibleRange) return;

                        const visiblePriceRange = visibleRange.max - visibleRange.min;

                        // Create fading lines for each individual order (not just predominant)
                        orders.forEach(order => {
                            const numFadeLines = 8; // Fewer lines to avoid clutter
                            const maxFadeHeight = Math.max(visiblePriceRange * 0.04, (visibleRange.max - visibleRange.min) * 0.02); // Dynamic height based on zoom level
                            const baseColor = order.direction === 'gt' ? "22, 197, 94" : "239, 68, 68"; // RGB values for green/red

                            // Store fade lines for cleanup (create array if it doesn't exist)
                            if (!(window as any).orderFadeLines) {
                                (window as any).orderFadeLines = [];
                            }

                            if (order.direction === 'gt') {
                                // For buy orders (≥): create fading lines ABOVE the order price
                                for (let i = 1; i <= numFadeLines; i++) {
                                    const lineHeight = (maxFadeHeight / numFadeLines) * i;
                                    const linePrice = price + lineHeight;
                                    const opacity = Math.max(0.1, 1 - (i / (numFadeLines * 0.4))); // Slower fade, more visible

                                    // Ensure line is within chart bounds, or extend chart if needed
                                    if (linePrice <= visibleRange.max * 1.2) { // Allow extension beyond visible range
                                        const fadeLine = seriesRef.current!.createPriceLine({
                                            price: linePrice,
                                            color: `rgba(${baseColor}, ${opacity * 0.6})`, // Higher opacity for better visibility
                                            lineWidth: Math.max(1, Math.floor(3 - (i / 3))) as 1 | 2 | 3 | 4, // Thicker lines
                                            lineStyle: LineStyle.Solid,
                                            axisLabelVisible: false,
                                            title: '',
                                        });

                                        orderLinesRef.current.push(fadeLine);
                                        (window as any).orderFadeLines.push(fadeLine);
                                    } else {
                                        console.log(`  Skipped GT fade line ${i} at price ${linePrice.toFixed(8)} (outside chart bounds)`);
                                    }
                                }
                            } else {
                                // For sell orders (≤): create fading lines BELOW the order price
                                for (let i = 1; i <= numFadeLines; i++) {
                                    const lineHeight = (maxFadeHeight / numFadeLines) * i;
                                    const linePrice = price - lineHeight;
                                    const opacity = Math.max(0.1, 1 - (i / (numFadeLines * 0.4))); // Slower fade, more visible

                                    // Ensure line is within chart bounds, or extend chart if needed
                                    if (linePrice >= visibleRange.min * 0.8) { // Allow extension beyond visible range
                                        const fadeLine = seriesRef.current!.createPriceLine({
                                            price: linePrice,
                                            color: `rgba(${baseColor}, ${opacity * 0.6})`, // Higher opacity for better visibility
                                            lineWidth: Math.max(1, Math.floor(3 - (i / 3))) as 1 | 2 | 3 | 4, // Thicker lines
                                            lineStyle: LineStyle.Solid,
                                            axisLabelVisible: false,
                                            title: '',
                                        });

                                        orderLinesRef.current.push(fadeLine);
                                        (window as any).orderFadeLines.push(fadeLine);
                                    } else {
                                        console.log(`  Skipped LT fade line ${i} at price ${linePrice.toFixed(8)} (outside chart bounds)`);
                                    }
                                }
                            }
                        });
                    }
                }
            } catch (error) {
                console.warn("Failed to add aggregated order line:", error);
            }
        });

        // Recreate manual grid lines to ensure they persist
        setTimeout(() => {
            addManualGridLines();
        }, 100);
    }, [data, userOrders, token.contractId, baseToken?.contractId, highlightedOrderId, getDataPointPrice]);

    // Update target price line and area zone
    useEffect(() => {
        if (!seriesRef.current || !data || data.length === 0) return;

        // Don't show target price line in sandwich or perpetual modes
        if (isSandwichMode || isPerpetualMode) {
            // Clean up any existing target lines when switching to these modes
            if (priceLineRef.current) {
                seriesRef.current.removePriceLine(priceLineRef.current);
                priceLineRef.current = null;
            }
            if (targetAreaRef.current) {
                chartRef.current?.removeSeries(targetAreaRef.current);
                targetAreaRef.current = null;
            }
            if ((window as any).targetFadeLines) {
                (window as any).targetFadeLines.forEach((line: any) => {
                    try {
                        seriesRef.current?.removePriceLine(line);
                    } catch (e) {
                        // Ignore errors when removing lines
                    }
                });
                (window as any).targetFadeLines = [];
            }
            return;
        }

        try {
            // Remove existing target price line
            if (priceLineRef.current) {
                seriesRef.current.removePriceLine(priceLineRef.current);
                priceLineRef.current = null;
            }

            // Remove existing target area
            if (targetAreaRef.current) {
                chartRef.current?.removeSeries(targetAreaRef.current);
                targetAreaRef.current = null;
            }

            // Remove existing fade lines
            if ((window as any).targetFadeLines) {
                (window as any).targetFadeLines.forEach((line: any) => {
                    try {
                        seriesRef.current?.removePriceLine(line);
                    } catch (e) {
                        // Ignore errors when removing lines
                    }
                });
                (window as any).targetFadeLines = [];
            }

            const price = parseFloat(targetPrice);
            console.log(`Target price check: raw="${targetPrice}", parsed=${price}, valid=${!isNaN(price) && price > 0 && targetPrice.trim() !== '' && targetPrice !== '0'}`);
            if (!isNaN(price) && price > 0 && targetPrice.trim() !== '' && targetPrice !== '0') {
                // Create the target price line
                priceLineRef.current = seriesRef.current.createPriceLine({
                    price,
                    color: "rgba(249, 115, 22, 0.8)", // Slightly transparent orange
                    lineWidth: 2, // Thinner line
                    lineStyle: LineStyle.Solid,
                    axisLabelVisible: true,
                    title: `Target: ${conditionDir === 'gt' ? '≥' : '≤'}`,
                });

                // Create target price area zone based on condition direction using visible range
                const visibleRange = getVisiblePriceRange();
                if (!visibleRange) return;

                const visiblePriceRange = visibleRange.max - visibleRange.min;

                // Store references to all the fade lines for cleanup
                if (!(window as any).targetFadeLines) {
                    (window as any).targetFadeLines = [];
                }

                // Create multiple lines with fading opacity based on visible chart height
                const numLines = 20; // More lines for tighter packing
                const maxHeight = Math.max(visiblePriceRange * 0.15, (visibleRange.max - visibleRange.min) * 0.05); // Dynamic height based on zoom level

                if (conditionDir === 'gt') {
                    // For ≥ (buy) orders: create fading lines ABOVE target price
                    for (let i = 1; i <= numLines; i++) {
                        const lineHeight = (maxHeight / numLines) * i;
                        const linePrice = price + lineHeight;
                        const opacity = Math.max(0.1, 1 - (i / (numLines * 0.7))); // Extend further before fading

                        if (linePrice <= visibleRange.max * 1.2) { // Allow extension beyond visible range
                            const fadeLine = seriesRef.current!.createPriceLine({
                                price: linePrice,
                                color: `rgba(249, 115, 22, ${opacity * 0.5})`, // Orange with fading opacity
                                lineWidth: 2, // Thicker lines
                                lineStyle: LineStyle.Solid,
                                axisLabelVisible: false,
                                title: '',
                            });

                            (window as any).targetFadeLines.push(fadeLine);
                        }
                    }
                    console.log(`Created ≥ target zone: ${numLines} fading lines above ${price}`);

                } else {
                    // For ≤ (sell) orders: create fading lines BELOW target price
                    for (let i = 1; i <= numLines; i++) {
                        const lineHeight = (maxHeight / numLines) * i;
                        const linePrice = price - lineHeight;
                        const opacity = Math.max(0.1, 1 - (i / (numLines * 0.7))); // Extend further before fading

                        if (linePrice >= visibleRange.min * 0.8) { // Allow extension beyond visible range
                            const fadeLine = seriesRef.current!.createPriceLine({
                                price: linePrice,
                                color: `rgba(249, 115, 22, ${opacity * 0.5})`, // Orange with fading opacity
                                lineWidth: 2, // Thicker lines
                                lineStyle: LineStyle.Solid,
                                axisLabelVisible: false,
                                title: '',
                            });

                            (window as any).targetFadeLines.push(fadeLine);
                        }
                    }
                    console.log(`Created ≤ target zone: ${numLines} fading lines below ${price}`);
                }
            }
        } catch (error) {
            console.warn("Failed to update target price line and zone:", error);
        }
    }, [targetPrice, conditionDir, data, isSandwichMode, isPerpetualMode]);

    // Update perpetual price lines (only when actual prices change, not UI state)
    useEffect(() => {
        if (!isPerpetualMode || !seriesRef.current || !data || data.length === 0) return;

        console.log('🎯 Updating perpetual price lines only - no chart recreation');

        try {
            // Remove existing perpetual lines
            if ((window as any).perpetualLines) {
                (window as any).perpetualLines.forEach((line: any) => {
                    try {
                        seriesRef.current?.removePriceLine(line);
                    } catch (e) {
                        // Ignore errors when removing lines
                    }
                });
                (window as any).perpetualLines = [];
            }

            // Create array if it doesn't exist
            if (!(window as any).perpetualLines) {
                (window as any).perpetualLines = [];
            }

            // Entry price line (purple for long, orange for short) with directional zones
            const entryPrice = parseFloat(perpetualEntryPrice || '');
            if (!isNaN(entryPrice) && entryPrice > 0) {
                const entryColor = perpetualDirection === 'long' ? '#8b5cf6' : '#f97316'; // Purple for long, orange for short
                const entryLine = seriesRef.current.createPriceLine({
                    price: entryPrice,
                    color: entryColor,
                    lineWidth: 3,
                    lineStyle: LineStyle.Solid,
                    axisLabelVisible: true,
                    title: `📈 Entry: ${perpetualDirection === 'long' ? 'LONG' : 'SHORT'}`,
                });
                (window as any).perpetualLines.push(entryLine);

                // Add entry zone visualization to show direction trigger
                if (data && data.length > 0) {
                    const visibleRange = getVisiblePriceRange();
                    if (!visibleRange) return;

                    const visiblePriceRange = visibleRange.max - visibleRange.min;

                    // Create entry zone based on direction using visible range
                    const numLines = 15;
                    const maxHeight = Math.max(visiblePriceRange * 0.08, (visibleRange.max - visibleRange.min) * 0.03); // Dynamic height based on zoom level

                    if (perpetualDirection === 'long') {
                        // LONG: Show subtle green zone ABOVE entry price (triggers when price goes up)
                        for (let i = 1; i <= numLines; i++) {
                            const lineHeight = (maxHeight / numLines) * i;
                            const linePrice = entryPrice + lineHeight;
                            const opacity = Math.max(0.02, 1 - (i / (numLines * 0.6))); // Much more subtle

                            if (linePrice <= visibleRange.max * 1.2) { // Allow extension beyond visible range
                                const entryFadeLine = seriesRef.current.createPriceLine({
                                    price: linePrice,
                                    color: `rgba(34, 197, 94, ${opacity * 0.08})`, // Green with very low opacity for LONG
                                    lineWidth: 1,
                                    lineStyle: LineStyle.Solid,
                                    axisLabelVisible: false,
                                    title: '',
                                });
                                (window as any).perpetualLines.push(entryFadeLine);
                            }
                        }
                    } else {
                        // SHORT: Show subtle red zone BELOW entry price (triggers when price goes down)
                        for (let i = 1; i <= numLines; i++) {
                            const lineHeight = (maxHeight / numLines) * i;
                            const linePrice = entryPrice - lineHeight;
                            const opacity = Math.max(0.02, 1 - (i / (numLines * 0.6))); // Much more subtle

                            if (linePrice >= visibleRange.min * 0.8) { // Allow extension beyond visible range
                                const entryFadeLine = seriesRef.current.createPriceLine({
                                    price: linePrice,
                                    color: `rgba(239, 68, 68, ${opacity * 0.08})`, // Red with very low opacity for SHORT
                                    lineWidth: 1,
                                    lineStyle: LineStyle.Solid,
                                    axisLabelVisible: false,
                                    title: '',
                                });
                                (window as any).perpetualLines.push(entryFadeLine);
                            }
                        }
                    }
                }
            }

            // Stop loss line (red)
            const stopLossPrice = parseFloat(perpetualStopLoss || '');
            if (!isNaN(stopLossPrice) && stopLossPrice > 0) {
                const stopLine = seriesRef.current.createPriceLine({
                    price: stopLossPrice,
                    color: '#ef4444', // Red
                    lineWidth: 2,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: '🛑 Stop Loss',
                });
                (window as any).perpetualLines.push(stopLine);
            }

            // Take profit line (green)
            const takeProfitPrice = parseFloat(perpetualTakeProfit || '');
            if (!isNaN(takeProfitPrice) && takeProfitPrice > 0) {
                const profitLine = seriesRef.current.createPriceLine({
                    price: takeProfitPrice,
                    color: '#22c55e', // Green
                    lineWidth: 2,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: '💰 Take Profit',
                });
                (window as any).perpetualLines.push(profitLine);
            }

        } catch (error) {
            console.warn("Failed to update perpetual price lines:", error);
        }
    }, [isPerpetualMode, perpetualDirection, perpetualEntryPrice, perpetualStopLoss, perpetualTakeProfit, data, getDataPointPrice]);



    // Clean up perpetual lines when exiting perpetual mode
    useEffect(() => {
        if (!isPerpetualMode && seriesRef.current) {
            if ((window as any).perpetualLines) {
                (window as any).perpetualLines.forEach((line: any) => {
                    try {
                        seriesRef.current?.removePriceLine(line);
                    } catch (e) {
                        // Ignore errors when removing lines
                    }
                });
                (window as any).perpetualLines = [];
            }
        }
    }, [isPerpetualMode]);

    // Function to get visible price range from chart
    const getVisiblePriceRange = useCallback(() => {
        if (!chartRef.current || !data || data.length === 0) {
            return null;
        }

        try {
            // Get the visible range from the chart
            const timeScale = chartRef.current.timeScale();
            const visibleRange = timeScale.getVisibleRange();

            if (!visibleRange) {
                // Fallback to full data range if visible range is not available
                const prices = data.map(d => getDataPointPrice(d));
                return {
                    min: Math.min(...prices),
                    max: Math.max(...prices)
                };
            }

            // Filter data points that are currently visible
            const visibleData = data.filter(point => {
                const time = Number(point.time);
                return time >= Number(visibleRange.from) && time <= Number(visibleRange.to);
            });

            if (visibleData.length === 0) {
                // Fallback to full data range
                const prices = data.map(d => getDataPointPrice(d));
                return {
                    min: Math.min(...prices),
                    max: Math.max(...prices)
                };
            }

            const visiblePrices = visibleData.map(d => getDataPointPrice(d));
            return {
                min: Math.min(...visiblePrices),
                max: Math.max(...visiblePrices)
            };
        } catch (error) {
            console.warn('Failed to get visible price range, using full data range:', error);
            // Fallback to full data range
            const prices = data.map(d => getDataPointPrice(d));
            return {
                min: Math.min(...prices),
                max: Math.max(...prices)
            };
        }
    }, [chartRef, data, getDataPointPrice]);

    // Function to add manual grid lines (extracted for reuse)
    const addManualGridLines = useCallback(() => {
        if (!seriesRef.current || !data || data.length === 0) return;

        const prices = data.map(d => getDataPointPrice(d));
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;

        // Calculate padding to extend grid lines beyond data range
        // With 20% scale margins, we need to extend the range by approximately 25% on each side
        // to fill the padded area (20% margin = 25% of visible range)
        const paddingPercent = 0.25; // 25% extension on each side
        const paddingAmount = priceRange * paddingPercent;

        // Extended range for grid line calculation
        const extendedMinPrice = minPrice - paddingAmount;
        const extendedMaxPrice = maxPrice + paddingAmount;
        const extendedRange = extendedMaxPrice - extendedMinPrice;

        // Dynamic precision calculation based on extended price range and magnitude
        const calculateOptimalGridInterval = (range: number, min: number, max: number): number => {
            // Calculate the order of magnitude for the range
            const rangeOrderOfMagnitude = Math.floor(Math.log10(range));

            // Calculate the order of magnitude for the average price
            const avgPrice = (min + max) / 2;
            const avgOrderOfMagnitude = Math.floor(Math.log10(Math.abs(avgPrice)));

            // Use the smaller order of magnitude to ensure good granularity
            const baseOrderOfMagnitude = Math.min(rangeOrderOfMagnitude, avgOrderOfMagnitude);

            // Start with a base interval
            const baseInterval = Math.pow(10, baseOrderOfMagnitude);

            // Adjust the interval to get a reasonable number of grid lines (15-40 lines)
            // Reduced target since we're covering a larger range now
            const targetGridLines = 25;
            let interval = baseInterval;
            const estimatedLines = range / interval;

            // Fine-tune the interval
            if (estimatedLines > 50) {
                // Too many lines, make interval larger
                if (estimatedLines > 100) {
                    interval = baseInterval * 5;
                } else {
                    interval = baseInterval * 2;
                }
            } else if (estimatedLines < 15) {
                // Too few lines, make interval smaller
                if (estimatedLines < 8) {
                    interval = baseInterval / 5;
                } else {
                    interval = baseInterval / 2;
                }
            }

            // Ensure minimum precision for very small numbers
            if (interval < 1e-12) {
                interval = 1e-12;
            }

            return interval;
        };

        const gridInterval = calculateOptimalGridInterval(extendedRange, extendedMinPrice, extendedMaxPrice);

        // Calculate start and end prices aligned to grid, using extended range
        const startPrice = Math.floor(extendedMinPrice / gridInterval) * gridInterval;
        const endPrice = Math.ceil(extendedMaxPrice / gridInterval) * gridInterval;

        // Determine appropriate decimal places for labels
        const getDecimalPlaces = (interval: number): number => {
            if (interval >= 1) return 2;
            if (interval >= 0.1) return 3;
            if (interval >= 0.01) return 4;
            if (interval >= 0.001) return 5;
            if (interval >= 0.0001) return 6;
            if (interval >= 0.00001) return 7;
            if (interval >= 0.000001) return 8;
            if (interval >= 0.0000001) return 9;
            if (interval >= 0.00000001) return 10;
            return 12; // Maximum precision
        };

        const decimalPlaces = getDecimalPlaces(gridInterval);

        // Create grid lines across the extended range
        let lineCount = 0;
        const maxLines = 150; // Increased limit since we're covering more range

        for (let price = startPrice; price <= endPrice && lineCount < maxLines; price += gridInterval) {
            // Round to avoid floating point precision issues
            price = Math.round(price / gridInterval) * gridInterval;

            // Create grid lines across the entire extended range, not just within data bounds
            // This ensures grid lines appear in the padded areas
            try {
                const gridLine = seriesRef.current!.createPriceLine({
                    price: price,
                    color: "rgba(156, 163, 175, 0.3)", // Subtle grid color
                    lineWidth: 1,
                    lineStyle: LineStyle.Solid,
                    axisLabelVisible: true,
                    title: '',
                });

                // Store grid lines for cleanup
                if (!(window as any).manualGridLines) {
                    (window as any).manualGridLines = [];
                }
                (window as any).manualGridLines.push(gridLine);
                lineCount++;
            } catch (e) {
                console.warn('Failed to create grid line at price:', price, e);
            }
        }

        console.log(`Added ${lineCount} manual grid lines from ${startPrice.toFixed(decimalPlaces)} to ${endPrice.toFixed(decimalPlaces)} with interval ${gridInterval.toFixed(decimalPlaces)} (data range: ${minPrice.toFixed(decimalPlaces)} - ${maxPrice.toFixed(decimalPlaces)}, extended range: ${extendedRange.toFixed(decimalPlaces)})`);
    }, [data, getDataPointPrice]);

    // Sandwich mode helper functions
    const createSandwichConfirmedLines = useCallback((buyPrice: number, sellPrice: number) => {
        if (!seriesRef.current) return;

        // Remove existing confirmed lines using refs for reliable tracking
        if (confirmedLinesRef.current.buyLine) {
            try {
                seriesRef.current.removePriceLine(confirmedLinesRef.current.buyLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
            confirmedLinesRef.current.buyLine = null;
        }
        if (confirmedLinesRef.current.sellLine) {
            try {
                seriesRef.current.removePriceLine(confirmedLinesRef.current.sellLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
            confirmedLinesRef.current.sellLine = null;
        }

        // Also clean up state-based confirmed lines as backup
        if (sandwichConfirmedLinesRef.current.buyLine) {
            try {
                seriesRef.current.removePriceLine(sandwichConfirmedLinesRef.current.buyLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
        }
        if (sandwichConfirmedLinesRef.current.sellLine) {
            try {
                seriesRef.current.removePriceLine(sandwichConfirmedLinesRef.current.sellLine);
            } catch (e) {
                // Ignore errors when removing lines
            }
        }

        // Create confirmed lines (full opacity)
        try {
            const buyLine = seriesRef.current.createPriceLine({
                price: buyPrice,
                color: "#3b82f6", // Blue for A→B
                lineWidth: 3,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: `🔵 A→B Trigger`,
            });

            const sellLine = seriesRef.current.createPriceLine({
                price: sellPrice,
                color: "#f97316", // Orange for B→A
                lineWidth: 3,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: `🟠 B→A Trigger`,
            });

            // Update both refs and state
            confirmedLinesRef.current = { buyLine, sellLine };
            sandwichConfirmedLinesRef.current = { buyLine, sellLine };
        } catch (e) {
            console.warn('Failed to create sandwich confirmed lines:', e);
        }
    }, []);

    // Effect to handle sandwich mode changes
    useEffect(() => {
        if (!isSandwichMode && seriesRef.current) {
            // Clean up sandwich lines when exiting sandwich mode
            if (confirmedLinesRef.current.buyLine) {
                seriesRef.current.removePriceLine(confirmedLinesRef.current.buyLine);
                confirmedLinesRef.current.buyLine = null;
            }
            if (confirmedLinesRef.current.sellLine) {
                seriesRef.current.removePriceLine(confirmedLinesRef.current.sellLine);
                confirmedLinesRef.current.sellLine = null;
            }
            // Also clean up state-based lines as backup
            if (sandwichConfirmedLinesRef.current.buyLine) {
                seriesRef.current.removePriceLine(sandwichConfirmedLinesRef.current.buyLine);
            }
            if (sandwichConfirmedLinesRef.current.sellLine) {
                seriesRef.current.removePriceLine(sandwichConfirmedLinesRef.current.sellLine);
            }
            sandwichConfirmedLinesRef.current = { buyLine: null, sellLine: null };
        }
    }, [isSandwichMode]);

    // Effect to update confirmed lines when sandwich prices change externally
    useEffect(() => {
        if (isSandwichMode && seriesRef.current && sandwichBuyPrice && sandwichSellPrice) {
            const buyPrice = parseFloat(sandwichBuyPrice);
            const sellPrice = parseFloat(sandwichSellPrice);
            if (!isNaN(buyPrice) && !isNaN(sellPrice)) {
                createSandwichConfirmedLines(buyPrice, sellPrice);
            }
        }
    }, [sandwichBuyPrice, sandwichSellPrice, isSandwichMode, createSandwichConfirmedLines]);

    // Load data on mount and when dependencies change
    useEffect(() => {
        loadChart();
    }, [loadChart]);

    // Cleanup refs when component unmounts
    useEffect(() => {
        return () => {
            noisyDataRef.current = null;
            historicDataRef.current = [];
            priceMomentumRef.current = 0;
        };
    }, []);

    // Optimized real-time price feed with incremental updates and reduced API calls
    useEffect(() => {
        if (!latestTokenRef.current?.contractId) return;

        const realTimeUpdateInterval = setInterval(() => {
            if (historicDataRef.current && historicDataRef.current.length > 0) {
                // Get only the current real-time price for incremental update
                const realTimeData = getCurrentRealTimePrice(latestTokenRef.current, latestBaseTokenRef.current);

                if (realTimeData.price && realTimeData.point) {
                    // Check if we have existing noisy data to update incrementally
                    const currentData = noisyDataRef.current || historicDataRef.current;
                    const lastPoint = currentData[currentData.length - 1];
                    const lastTime = Number(lastPoint.time);
                    const newTime = Number(realTimeData.point.time);

                    // Only update if the price has changed significantly or enough time has passed
                    const timeDiff = newTime - lastTime;
                    const priceDiff = Math.abs(realTimeData.price - lastPoint.value) / lastPoint.value;

                    if (timeDiff > 60 || priceDiff > 0.001) { // 1 minute or 0.1% price change
                        // Efficient incremental update
                        let updatedData: LineData[];

                        if (timeDiff < 300) { // Less than 5 minutes - replace last point
                            updatedData = currentData.slice();
                            updatedData[updatedData.length - 1] = realTimeData.point;
                        } else { // More than 5 minutes - append new point
                            updatedData = [...currentData, realTimeData.point];
                        }

                        // Store updated data
                        noisyDataRef.current = updatedData;

                        // Efficient chart update with incremental API
                        if (chartRef.current && seriesRef.current && !isInitialLoadRef.current) {
                            updateChartData(updatedData, true, realTimeData.point);
                        }

                        // Update price state
                        setCurrentPrice(realTimeData.price);
                        if (latestOnCurrentPriceChangeRef.current) {
                            latestOnCurrentPriceChangeRef.current(realTimeData.price);
                        }

                        // Calculate price change efficiently
                        if (updatedData.length > 1) {
                            const previous = getDataPointPrice(updatedData[updatedData.length - 2]);
                            const change = realTimeData.price - previous;
                            const percentage = (change / previous) * 100;
                            setPriceChange({ value: change, percentage });
                        }

                        console.log(`⚡ Incremental price update: ${realTimeData.price.toFixed(8)} (${priceDiff > 0.001 ? 'price change' : 'time elapsed'})`);
                    }
                } else {
                    // Fallback to full enhancement if incremental fails
                    const enhancedData = enhanceWithRealTimePrice(historicDataRef.current, latestTokenRef.current, latestBaseTokenRef.current);
                    noisyDataRef.current = enhancedData;

                    if (chartRef.current && seriesRef.current && !isInitialLoadRef.current) {
                        updateChartData(enhancedData, true);
                    }
                }
            }
        }, 60000); // 60 second updates to reduce re-render frequency

        return () => clearInterval(realTimeUpdateInterval);
    }, []); // Empty deps array to prevent re-running the effect

    // Memoized price range calculation to prevent recalculation on every render
    // IMPORTANT: This must be before any conditional returns to avoid hook order issues
    const priceRange = useMemo(() => {
        if (!data || data.length === 0) return undefined;

        const prices = data.map(d => getDataPointPrice(d));
        return {
            min: Math.min(...prices),
            max: Math.max(...prices)
        };
    }, [data, getDataPointPrice]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
                    <div className="text-sm text-muted-foreground">Loading chart data...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <TrendingDown className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <div className="text-sm text-red-600 mb-2">Failed to load chart</div>
                    <Button variant="outline" size="sm" onClick={loadChart}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col relative">
            {/* Chart Container */}
            <div ref={containerRef} className="flex-1 min-h-0" />

            {/* Sandwich Preview Overlay */}
            <SandwichPreviewOverlay
                chartContainerRef={containerRef}
                currentPrice={currentPrice || undefined}
                priceRange={priceRange}
                chartRef={chartRef}
                seriesRef={seriesRef}
            />

            {/* Target Price Hover Overlay for DCA and Single Orders */}
            <TargetPriceHoverOverlay
                chartContainerRef={containerRef}
                currentPrice={currentPrice || undefined}
                priceRange={priceRange}
                chartRef={chartRef}
                seriesRef={seriesRef}
            />
        </div>
    );
});

export default ProModeChart;

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

        if (currentBase && currentBase > 0 && !isNaN(currentBase) && point.value && point.value > 0 && !isNaN(point.value)) {
            const ratio = currentBase / point.value;  // Inverted: base/token instead of token/base
            if (ratio > 0 && isFinite(ratio)) {  // Ensure ratio is positive and finite
                ratioData.push({
                    time: point.time,
                    value: ratio
                });
            }
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
        isFinite(point.value) &&
        point.value > 0  // Prices must be positive
    );
} 