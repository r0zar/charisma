'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    LineSeries,
    ColorType,
} from 'lightweight-charts';
import { usePriceSeriesService } from '@/lib/price-series-service';
import { perfMonitor } from '@/lib/performance-monitor';
import { useBlaze } from 'blaze-sdk/realtime';
import { useWallet } from '@/contexts/wallet-context';
import { 
    enhanceSparseTokenData, 
    calculateResilientRatioData, 
    type ChartDataPoint,
    type TimeRange
} from '@/lib/chart-data-utils';

interface TokenChartProps {
    primary: string; // contract ID of the primary token
    compareId?: string | null; // optional compare ID
    primaryColor: string;
    compareColor: string;
}

export default function TokenChart({ primary, compareId, primaryColor, compareColor }: TokenChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const primarySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const compareSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [primaryDataCount, setPrimaryDataCount] = useState(0);
    const [compareDataCount, setCompareDataCount] = useState(0);
    const [activeTimeRange, setActiveTimeRange] = useState<string>('7D');
    const [comparisonMode, setComparisonMode] = useState<'absolute' | 'ratio'>('absolute');

    // Real-time price integration
    const { address } = useWallet();
    const { getPrice, isConnected } = useBlaze({ userId: address });
    const lastPrimaryPriceRef = useRef<number | null>(null);
    const lastComparePriceRef = useRef<number | null>(null);

    // Time range definitions
    const timeRanges = useMemo(() => {
        const now = Math.floor(Date.now() / 1000);
        return {
            '1H': { from: now - 3600, to: now, label: '1H' },
            '24H': { from: now - 86400, to: now, label: '24H' },
            '7D': { from: now - 604800, to: now, label: '7D' },
            '30D': { from: now - 2592000, to: now, label: '30D' },
            'ALL': { from: null, to: null, label: 'ALL' }
        };
    }, []);

    // Use compareId directly from props (managed by context in parent)

    // Memoize chart configuration to avoid unnecessary recreations
    const chartConfig = useMemo(() => ({
        height: 400,
        layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#9ca3af', // tailwind muted-foreground
        },
        grid: {
            vertLines: { color: 'rgba(133, 133, 133, 0.1)' },
            horzLines: { color: 'rgba(133, 133, 133, 0.1)' },
        },
        timeScale: { 
            timeVisible: true, 
            secondsVisible: false,
            rightOffset: 12,
            barSpacing: 3,
            fixLeftEdge: false, // Allow chart to show recent data
            lockVisibleTimeRangeOnResize: false, // Allow auto-fitting
            shiftVisibleRangeOnNewBar: true, // Follow new data
        },
        leftPriceScale: {
            visible: true,
            borderVisible: false,
            scaleMargins: { top: 0.2, bottom: 0.2 },
        },
        rightPriceScale: {
            visible: true,
            borderVisible: false,
            scaleMargins: { top: 0.2, bottom: 0.2 },
        },
        crosshair: {
            mode: 1, // Normal crosshair mode
        },
        handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
        },
        handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
        },
    }), []);

    /* -------- initialise chart -------- */
    useEffect(() => {
        if (!containerRef.current) return;
        
        const timer = perfMonitor.startTiming('chart-initialization');
        
        try {
            chartRef.current = createChart(containerRef.current, chartConfig);
            primarySeriesRef.current = chartRef.current.addSeries(LineSeries, {
                color: primaryColor,
                priceScaleId: 'left',
                lineWidth: 2,
                lastValueVisible: true,
                priceLineVisible: true,
            }) as ISeriesApi<'Line'>;

            timer.end({ success: true });
            console.log('[TOKEN-CHART] Chart initialized successfully');
            
        } catch (error) {
            timer.end({ success: false, error: String(error) });
            console.error('[TOKEN-CHART] Failed to initialize chart:', error);
            setError(`Failed to initialize chart: ${String(error)}`);
        }

        // cleanup chart on unmount
        return () => {
            chartRef.current?.remove();
        };
    }, [chartConfig, primaryColor]);

    const priceSeriesService = usePriceSeriesService();

    // Helper function to convert LineData to ChartDataPoint format
    const convertToChartDataPoints = (data: LineData[]): ChartDataPoint[] => {
        return data.map(point => ({
            time: Number(point.time) * 1000, // Convert to milliseconds
            value: point.value
        }));
    };

    // Helper function to convert ChartDataPoint back to LineData format
    const convertToLineData = (data: ChartDataPoint[]): LineData[] => {
        return data.map(point => ({
            time: Math.floor(point.time / 1000) as any, // Convert back to seconds
            value: point.value
        }));
    };

    // Chart data extrapolation now handled by chart-data-utils

    /* -------- load token series data (primary + comparison in bulk) -------- */
    useEffect(() => {
        if (!primarySeriesRef.current) return;
        
        const timer = perfMonitor.startTiming('chart-load-bulk-data');
        setLoading(true);
        setError(null);
        
        // Determine which tokens to fetch
        const tokensToFetch = [primary];
        if (compareId) {
            tokensToFetch.push(compareId);
        }
        
        console.log('[TOKEN-CHART] Loading bulk token data:', {
            primary: primary.substring(0, 10),
            compare: compareId?.substring(0, 10),
            total: tokensToFetch.length
        });
        
        // Use bulk fetch for efficiency
        priceSeriesService.fetchBulkPriceSeries(tokensToFetch)
            .then((bulkData) => {
                const rawPrimaryData = bulkData[primary] || [];
                const rawCompareData = compareId ? (bulkData[compareId] || []) : [];
                
                // Determine if we should use ratio comparison mode
                const useRatioMode = compareId && rawCompareData.length > 0;
                
                let primaryData: LineData[];
                
                if (useRatioMode) {
                    console.log('[TOKEN-CHART] Computing ratio with extrapolation...');
                    
                    // Convert to ChartDataPoint format for extrapolation utilities
                    const primaryChartData = convertToChartDataPoints(rawPrimaryData);
                    const compareChartData = convertToChartDataPoints(rawCompareData);
                    
                    // Use resilient ratio calculation with extrapolation
                    const ratioChartData = calculateResilientRatioData(primaryChartData, compareChartData, {
                        minPoints: 15, // Ensure smooth charts even with sparse data
                        defaultTimeRangeMs: 30 * 24 * 60 * 60 * 1000 // 30 days
                    });
                    
                    // Convert back to LineData format
                    primaryData = convertToLineData(ratioChartData);
                    setComparisonMode('ratio');
                    
                    console.log(`[TOKEN-CHART] Ratio calculation: ${rawPrimaryData.length}+${rawCompareData.length} -> ${primaryData.length} points`);
                    
                    // Remove comparison series since we only show ratio
                    if (compareSeriesRef.current && chartRef.current) {
                        chartRef.current.removeSeries(compareSeriesRef.current);
                        compareSeriesRef.current = null;
                        setCompareDataCount(0);
                    }
                } else {
                    console.log('[TOKEN-CHART] Enhancing sparse token data...');
                    
                    // Convert to ChartDataPoint format
                    const primaryChartData = convertToChartDataPoints(rawPrimaryData);
                    
                    // Enhance sparse data with extrapolation
                    const enhancedChartData = enhanceSparseTokenData(primaryChartData, undefined, 15);
                    
                    // Convert back to LineData format
                    primaryData = convertToLineData(enhancedChartData);
                    setComparisonMode('absolute');
                    
                    console.log(`[TOKEN-CHART] Data enhancement: ${rawPrimaryData.length} -> ${primaryData.length} points`);
                    
                    // Remove comparison series if switching back to single token
                    if (compareSeriesRef.current && chartRef.current) {
                        chartRef.current.removeSeries(compareSeriesRef.current);
                        compareSeriesRef.current = null;
                        setCompareDataCount(0);
                    }
                }
                
                // Sort by time and remove duplicates (required by lightweight-charts)
                const sortedData = primaryData.sort((a, b) => Number(a.time) - Number(b.time));
                const deduplicatedData = sortedData.filter((point, index) => {
                    if (index === 0) return true;
                    return Number(point.time) !== Number(sortedData[index - 1].time);
                });
                
                if (primarySeriesRef.current) {
                    primarySeriesRef.current.setData(deduplicatedData);
                    setPrimaryDataCount(deduplicatedData.length);
                    
                    console.log('[TOKEN-CHART] Data deduplication:', {
                        originalPoints: primaryData.length,
                        finalPoints: deduplicatedData.length,
                        duplicatesRemoved: primaryData.length - deduplicatedData.length
                    });
                    
                    // Set initial time range to show recent data
                    if (chartRef.current && deduplicatedData.length > 0) {
                        setTimeout(() => {
                            if (chartRef.current) {
                                // Apply the default 7D time range
                                const range = (timeRanges as any)[activeTimeRange];
                                if (range && range.from && range.to) {
                                    chartRef.current.timeScale().setVisibleRange({
                                        from: range.from,
                                        to: range.to
                                    });
                                } else {
                                    chartRef.current.timeScale().fitContent();
                                }
                            }
                        }, 100); // Small delay to ensure data is rendered
                    }
                }
                
                // Update price scale formatting based on mode
                if (chartRef.current) {
                    chartRef.current.applyOptions({
                        leftPriceScale: {
                            ...chartConfig.leftPriceScale,
                            // Format as ratio when in comparison mode
                            ...(useRatioMode ? { 
                                priceFormat: {
                                    type: 'price' as const, 
                                    precision: 6,
                                    minMove: 0.000001
                                }
                            } : { 
                                priceFormat: {
                                    type: 'price' as const, 
                                    precision: 4
                                }
                            })
                        }
                    });
                }
                
                timer.end({ 
                    success: true, 
                    primaryDataPoints: primaryData.length,
                    compareDataPoints: compareId ? rawCompareData.length : 0,
                    bulkFetch: true,
                    comparisonMode: useRatioMode ? 'ratio' : 'absolute'
                });
                
                console.log('[TOKEN-CHART] Bulk data loaded:', {
                    primaryPoints: primaryData.length,
                    rawComparePoints: compareId ? rawCompareData.length : 0,
                    mode: useRatioMode ? 'ratio' : 'absolute'
                });
                setLoading(false);
            })
            .catch((error) => {
                timer.end({ success: false, error: String(error) });
                console.error('[TOKEN-CHART] Failed to load bulk data:', error);
                setError(`Failed to load chart data: ${String(error)}`);
                setLoading(false);
            });
    }, [primary, compareId, priceSeriesService, compareColor]);

    /* -------- real-time price updates -------- */
    useEffect(() => {
        if (!primarySeriesRef.current) return;

        const primaryPrice = getPrice(primary);
        const comparePrice = compareId ? getPrice(compareId) : null;
        
        // Update primary series with real-time price
        if (primaryPrice !== null && primaryPrice !== lastPrimaryPriceRef.current) {
            const now = Math.floor(Date.now() / 1000);
            try {
                primarySeriesRef.current.update({
                    time: now as any,
                    value: primaryPrice
                });
                lastPrimaryPriceRef.current = primaryPrice ?? null;
                console.log('[TOKEN-CHART] Updated primary price:', primaryPrice);
            } catch (error) {
                console.warn('[TOKEN-CHART] Failed to update primary price:', error);
            }
        }

        // Update comparison series with real-time price
        if (compareSeriesRef.current && comparePrice !== null && comparePrice !== lastComparePriceRef.current) {
            const now = Math.floor(Date.now() / 1000);
            try {
                compareSeriesRef.current.update({
                    time: now as any,
                    value: comparePrice
                });
                lastComparePriceRef.current = comparePrice ?? null;
                console.log('[TOKEN-CHART] Updated compare price:', comparePrice);
            } catch (error) {
                console.warn('[TOKEN-CHART] Failed to update compare price:', error);
            }
        }
    }, [getPrice(primary), compareId ? getPrice(compareId) : null, primary, compareId]);

    /* -------- time range selection -------- */
    const handleTimeRangeChange = (rangeKey: string) => {
        const range = timeRanges[rangeKey as keyof typeof timeRanges];
        if (!range || !chartRef.current) return;

        const timer = perfMonitor.startTiming('chart-time-range-change');
        
        try {
            if (range.from && range.to) {
                // Set visible range for specific time periods
                chartRef.current.timeScale().setVisibleRange({
                    from: range.from as any,
                    to: range.to as any
                });
            } else {
                // For 'ALL', fit all data with proper margins
                chartRef.current.timeScale().fitContent();
                // Ensure we're showing the most recent data
                setTimeout(() => {
                    if (chartRef.current) {
                        chartRef.current.timeScale().scrollToRealTime();
                    }
                }, 50);
            }
            
            setActiveTimeRange(rangeKey);
            timer.end({ 
                success: true, 
                range: rangeKey,
                from: range.from,
                to: range.to 
            });
            
            console.log(`[TOKEN-CHART] Changed time range to ${rangeKey}`);
        } catch (error) {
            timer.end({ success: false, error: String(error) });
            console.error('[TOKEN-CHART] Failed to change time range:', error);
        }
    };

    /* -------- update colors when they change -------- */
    useEffect(() => {
        primarySeriesRef.current?.applyOptions({ color: primaryColor });
    }, [primaryColor]);

    useEffect(() => {
        compareSeriesRef.current?.applyOptions({ color: compareColor });
    }, [compareColor]);

    /* -------- responsive resize -------- */
    useEffect(() => {
        function handleResize() {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
            }
        }
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="space-y-6">
            {/* Clean time range controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {Object.entries(timeRanges).map(([key, range]) => (
                        <button
                            key={key}
                            onClick={() => handleTimeRangeChange(key)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                                activeTimeRange === key
                                    ? 'bg-white/[0.08] text-white border border-white/[0.2]'
                                    : 'text-white/60 hover:text-white/90 hover:bg-white/[0.03] border border-transparent'
                            }`}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
                
                {/* Enhanced real-time indicator with glow */}
                {isConnected && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                        <div className="relative">
                            <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
                            <div className="absolute inset-0 h-2 w-2 bg-emerald-400/40 rounded-full animate-ping" />
                            <div className="absolute inset-[-2px] h-3 w-3 bg-emerald-400/20 rounded-full blur-sm animate-pulse" />
                        </div>
                        <span className="animate-pulse">Live data</span>
                    </div>
                )}
            </div>

            {/* Minimal chart info */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {comparisonMode === 'ratio' && compareId ? (
                        <div className="flex items-center gap-3 text-xs text-white/50">
                            <div className="flex items-center gap-1.5">
                                <div 
                                    className="w-2.5 h-2.5 rounded-full" 
                                    style={{ backgroundColor: primaryColor }}
                                />
                                <span className="text-white/30">/</span>
                                <div 
                                    className="w-2.5 h-2.5 rounded-full" 
                                    style={{ backgroundColor: compareColor }}
                                />
                            </div>
                            <span>Ratio • {primaryDataCount} points</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 text-xs text-white/50">
                            <div 
                                className="w-2.5 h-2.5 rounded-full" 
                                style={{ backgroundColor: primaryColor }}
                            />
                            <span>Price • {primaryDataCount} points</span>
                        </div>
                    )}
                </div>
                {error && (
                    <div className="text-red-400 text-xs">
                        {error}
                    </div>
                )}
            </div>

            {/* Clean chart container */}
            <div ref={containerRef} className="w-full relative rounded-2xl overflow-hidden border border-white/[0.05] bg-black/20">
                {loading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 backdrop-blur-sm">
                        <div className="flex items-center gap-3 text-sm text-white/70">
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                            <span>Loading chart data...</span>
                        </div>
                    </div>
                )}
                
                {error && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="text-center p-6 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm">
                            <div className="text-red-400 text-sm font-medium mb-2">Chart Error</div>
                            <div className="text-red-300/80 text-xs mb-4">{error}</div>
                            <button 
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-colors duration-200"
                            >
                                Reload
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}