'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    type CandlestickData,
    type HistogramData,
    LineSeries,
    CandlestickSeries,
    HistogramSeries,
    ColorType,
} from 'lightweight-charts';
import { perfMonitor } from '@/lib/performance-monitor';
import AdvancedChartControls, { 
    CHART_TIMEFRAMES, 
    DEFAULT_INDICATORS,
    getTimeframeConfig,
    calculateDataPointsNeeded,
    type TechnicalIndicator 
} from './advanced-chart-controls';
import {
    enhanceSparseTokenData,
    calculateResilientRatioData,
    type ChartDataPoint
} from '@/lib/chart-data-utils';

interface EnhancedTokenChartProps {
    primary: string;
    compareId?: string | null;
    primaryColor: string;
    compareColor: string;
    preloadedData?: Record<string, any>;
}

interface ChartSeries {
    line?: ISeriesApi<'Line'>;
    candlestick?: ISeriesApi<'Candlestick'>;
    volume?: ISeriesApi<'Histogram'>;
    indicators: { [key: string]: ISeriesApi<'Line'> };
}

// Data cache for performance
const chartDataCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute

export default function EnhancedTokenChart({ 
    primary, 
    compareId, 
    primaryColor, 
    compareColor,
    preloadedData 
}: EnhancedTokenChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ChartSeries>({ indicators: {} });
    
    // Chart state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTimeframe, setActiveTimeframe] = useState<string>('1D');
    const [activeChartType, setActiveChartType] = useState<string>('line');
    const [technicalIndicators, setTechnicalIndicators] = useState<TechnicalIndicator[]>(DEFAULT_INDICATORS);
    const [dataPointCount, setDataPointCount] = useState(0);
    const [comparisonMode, setComparisonMode] = useState<'absolute' | 'ratio'>('absolute');

    // Enhanced chart configuration with better performance
    const chartConfig = useMemo(() => ({
        height: 450,
        layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#9ca3af',
            fontSize: 12,
        },
        grid: {
            vertLines: { color: 'rgba(133, 133, 133, 0.08)' },
            horzLines: { color: 'rgba(133, 133, 133, 0.08)' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 16,
            barSpacing: activeTimeframe === '5M' || activeTimeframe === '15M' ? 6 : 4,
            fixLeftEdge: false,
            lockVisibleTimeRangeOnResize: false,
            shiftVisibleRangeOnNewBar: true,
        },
        leftPriceScale: {
            visible: true,
            borderVisible: false,
            scaleMargins: { top: 0.15, bottom: activeChartType === 'volume' ? 0.4 : 0.15 },
            autoScale: true,
        },
        rightPriceScale: {
            visible: false,
        },
        crosshair: {
            mode: 1,
            vertLine: {
                color: 'rgba(255, 255, 255, 0.2)',
                width: 1,
                style: 3, // dashed
            },
            horzLine: {
                color: 'rgba(255, 255, 255, 0.2)',
                width: 1,
                style: 3,
            },
        },
        localization: {
            priceFormatter: (price: number) => {
                if (price < 0.000001) return price.toExponential(3);
                if (price < 0.001) return price.toFixed(8);
                if (price < 1) return price.toFixed(6);
                if (price < 1000) return price.toFixed(4);
                return price.toFixed(2);
            },
        },
        handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
        },
        handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
        },
        kineticScroll: {
            touch: true,
            mouse: false,
        },
    }), [activeTimeframe, activeChartType]);

    // Initialize chart
    useEffect(() => {
        if (!containerRef.current) return;

        const timer = perfMonitor.startTiming('enhanced-chart-initialization');

        try {
            chartRef.current = createChart(containerRef.current, chartConfig);
            seriesRef.current = { indicators: {} };

            timer.end({ success: true, chartType: activeChartType });
        } catch (error) {
            timer.end({ success: false, error: String(error) });
            console.error('[ENHANCED-CHART] Failed to initialize chart:', error);
            setError(`Failed to initialize chart: ${String(error)}`);
        }

        return () => {
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [chartConfig]);

    // Get data from preloaded SSR data
    const getChartData = useCallback((contractId: string, timeframe: string): LineData[] => {
        if (!preloadedData) {
            console.warn('[ENHANCED-CHART] No preloadedData provided at all');
            return [];
        }

        const tokenData = preloadedData[contractId];
        if (!tokenData) {
            console.warn('[ENHANCED-CHART] No preloaded data for token', contractId.substring(0, 10), 
                'Available tokens:', Object.keys(preloadedData).map(k => k.substring(0, 10)));
            return [];
        }

        // Map timeframe to available data
        let dataKey = '1h'; // default
        switch (timeframe) {
            case '5M':
            case '15M':
            case '1H':
                dataKey = '5m';
                break;
            case '4H':
            case '1D':
            case '7D':
                dataKey = '1h';
                break;
            case '30D':
            case 'ALL':
                dataKey = '1d';
                break;
        }

        const rawData = tokenData[dataKey] || [];
        console.log('[ENHANCED-CHART] Using preloaded data for', contractId.substring(0, 10), timeframe, 
            '-> dataKey:', dataKey, 'points:', rawData.length, 
            'Available keys:', Object.keys(tokenData));
        
        // Validate data structure
        if (!Array.isArray(rawData)) {
            console.warn('[ENHANCED-CHART] Raw data is not array:', typeof rawData, rawData);
            return [];
        }

        // Convert to LineData format with validation
        const validData = rawData
            .filter((point: any) => point && typeof point === 'object' && point.time && point.value)
            .map((point: any) => ({
                time: point.time as any,
                value: Number(point.value) || 0
            }));

        console.log('[ENHANCED-CHART] Filtered valid data points:', validData.length, 'from', rawData.length);
        return validData;
    }, [preloadedData]);

    // Technical indicator calculations
    const calculateSMA = useCallback((data: LineData[], period: number): LineData[] => {
        const result: LineData[] = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((acc, point) => acc + point.value, 0);
            result.push({
                time: data[i].time,
                value: sum / period
            });
        }
        return result;
    }, []);

    const calculateEMA = useCallback((data: LineData[], period: number): LineData[] => {
        const result: LineData[] = [];
        const multiplier = 2 / (period + 1);
        
        if (data.length === 0) return result;
        
        // Start with SMA for first value
        result.push(data[0]);
        
        for (let i = 1; i < data.length; i++) {
            const emaValue = (data[i].value * multiplier) + (result[i - 1].value * (1 - multiplier));
            result.push({
                time: data[i].time,
                value: emaValue
            });
        }
        
        return result;
    }, []);

    // Create chart series based on type
    const createChartSeries = useCallback(() => {
        if (!chartRef.current) return;

        // Clear existing series
        Object.values(seriesRef.current.indicators).forEach(series => {
            chartRef.current!.removeSeries(series);
        });
        if (seriesRef.current.line) chartRef.current.removeSeries(seriesRef.current.line);
        if (seriesRef.current.candlestick) chartRef.current.removeSeries(seriesRef.current.candlestick);
        if (seriesRef.current.volume) chartRef.current.removeSeries(seriesRef.current.volume);

        seriesRef.current = { indicators: {} };

        // Create main series based on chart type
        switch (activeChartType) {
            case 'line':
                seriesRef.current.line = chartRef.current.addSeries(LineSeries, {
                    color: primaryColor,
                    lineWidth: 2,
                    lastValueVisible: true,
                    priceLineVisible: true,
                    crosshairMarkerVisible: true,
                    lineStyle: 0, // solid
                });
                break;

            case 'area':
                seriesRef.current.line = chartRef.current.addSeries(LineSeries, {
                    color: primaryColor,
                    lineWidth: 2,
                    lastValueVisible: true,
                    priceLineVisible: true,
                    topColor: primaryColor + '40',
                    bottomColor: primaryColor + '00',
                    lineStyle: 0,
                });
                break;

            case 'candlestick':
                seriesRef.current.candlestick = chartRef.current.addSeries(CandlestickSeries, {
                    upColor: '#10b981',
                    downColor: '#ef4444',
                    borderVisible: true,
                    wickUpColor: '#10b981',
                    wickDownColor: '#ef4444',
                    borderUpColor: '#10b981',
                    borderDownColor: '#ef4444',
                    lastValueVisible: true,
                    priceLineVisible: true,
                });
                break;

            case 'volume':
                seriesRef.current.line = chartRef.current.addSeries(LineSeries, {
                    color: primaryColor,
                    lineWidth: 2,
                    lastValueVisible: true,
                    priceLineVisible: true,
                });
                seriesRef.current.volume = chartRef.current.addSeries(HistogramSeries, {
                    color: primaryColor + '60',
                    priceFormat: { type: 'volume' },
                    priceScaleId: 'volume',
                    scaleMargins: { top: 0.8, bottom: 0 },
                });
                break;
        }

        // Add technical indicators
        technicalIndicators.forEach(indicator => {
            if (indicator.enabled) {
                seriesRef.current.indicators[indicator.key] = chartRef.current!.addSeries(LineSeries, {
                    color: indicator.color,
                    lineWidth: 1,
                    lastValueVisible: false,
                    priceLineVisible: false,
                    lineStyle: 1, // dotted for indicators
                });
            }
        });

    }, [activeChartType, primaryColor, technicalIndicators]);

    // Load chart data
    const loadChartData = useCallback(async () => {
        if (!chartRef.current) return;

        setLoading(true);
        setError(null);

        const timer = perfMonitor.startTiming('enhanced-chart-data-load');

        try {
            // Get data from preloaded SSR data
            const primaryData = getChartData(primary, activeTimeframe);
            const compareData = compareId ? getChartData(compareId, activeTimeframe) : [];

            console.log('[ENHANCED-CHART] Raw data loaded:', {
                primary: primaryData.length,
                compare: compareData.length,
                timeframe: activeTimeframe
            });

            // Early return if no data available
            if (primaryData.length === 0) {
                console.warn('[ENHANCED-CHART] No primary data available for', primary.substring(0, 10));
                setDataPointCount(0);
                timer.end({ success: true, dataPoints: 0, reason: 'no-primary-data' });
                return;
            }

            let processedData: LineData[] = [];
            let volumeData: HistogramData[] = [];

            // Process data based on comparison mode
            if (compareId && compareData.length > 0 && comparisonMode === 'ratio') {
                // Convert to ChartDataPoint format for ratio calculation
                const primaryChartData = primaryData.map((p: any) => ({
                    time: Number(p.time) * 1000,
                    value: p.value
                }));
                const compareChartData = compareData.map((p: any) => ({
                    time: Number(p.time) * 1000,
                    value: p.value
                }));

                const ratioData = calculateResilientRatioData(primaryChartData, compareChartData, {
                    minPoints: 50
                });

                processedData = ratioData.map(point => ({
                    time: Math.floor(point.time / 1000) as any,
                    value: point.value
                }));
            } else {
                // Enhance sparse data
                const primaryChartData = primaryData.map((p: any) => ({
                    time: Number(p.time) * 1000,
                    value: p.value
                }));

                const enhancedData = enhanceSparseTokenData(primaryChartData, undefined, 50);
                processedData = enhancedData.map(point => ({
                    time: Math.floor(point.time / 1000) as any,
                    value: point.value
                }));

                // Generate mock volume data for volume chart
                if (activeChartType === 'volume') {
                    volumeData = processedData.map(point => ({
                        time: point.time,
                        value: Math.random() * 1000000, // Mock volume
                        color: primaryColor + '60'
                    }));
                }
            }

            // Sort and deduplicate data
            const sortedData = processedData.sort((a, b) => Number(a.time) - Number(b.time));
            const deduplicatedData = sortedData.filter((point, index) => {
                if (index === 0) return true;
                return Number(point.time) !== Number(sortedData[index - 1].time);
            });

            // Set data to appropriate series
            if (activeChartType === 'candlestick' && seriesRef.current.candlestick) {
                // Convert to candlestick format (mock OHLC from line data)
                const candlestickData: CandlestickData[] = deduplicatedData.map(point => ({
                    time: point.time,
                    open: point.value * (0.99 + Math.random() * 0.02),
                    high: point.value * (1.001 + Math.random() * 0.02),
                    low: point.value * (0.99 + Math.random() * 0.02),
                    close: point.value
                }));
                seriesRef.current.candlestick.setData(candlestickData);
            } else if (seriesRef.current.line) {
                seriesRef.current.line.setData(deduplicatedData);
            }

            // Set volume data if applicable
            if (seriesRef.current.volume && volumeData.length > 0) {
                seriesRef.current.volume.setData(volumeData);
            }

            // Calculate and set technical indicators
            technicalIndicators.forEach(indicator => {
                if (indicator.enabled && seriesRef.current.indicators[indicator.key]) {
                    let indicatorData: LineData[] = [];

                    switch (indicator.key) {
                        case 'sma20':
                            indicatorData = calculateSMA(deduplicatedData, 20);
                            break;
                        case 'sma50':
                            indicatorData = calculateSMA(deduplicatedData, 50);
                            break;
                        case 'ema12':
                            indicatorData = calculateEMA(deduplicatedData, 12);
                            break;
                        case 'ema26':
                            indicatorData = calculateEMA(deduplicatedData, 26);
                            break;
                    }

                    if (indicatorData.length > 0) {
                        seriesRef.current.indicators[indicator.key].setData(indicatorData);
                    }
                }
            });

            setDataPointCount(deduplicatedData.length);

            // Fit chart to time range (only if we have data)
            setTimeout(() => {
                if (chartRef.current && deduplicatedData.length > 0) {
                    const timeframeConfig = getTimeframeConfig(activeTimeframe);
                    if (timeframeConfig && timeframeConfig.duration > 0) {
                        const now = Math.floor(Date.now() / 1000);
                        const earliestTime = Math.min(...deduplicatedData.map(d => Number(d.time)));
                        const fromTime = Math.max(earliestTime, now - timeframeConfig.duration);
                        
                        // Only set visible range if we have valid time bounds
                        if (fromTime < now && earliestTime <= fromTime) {
                            chartRef.current.timeScale().setVisibleRange({
                                from: fromTime as any,
                                to: now as any
                            });
                        } else {
                            chartRef.current.timeScale().fitContent();
                        }
                    } else {
                        chartRef.current.timeScale().fitContent();
                    }
                }
            }, 100);

            timer.end({
                success: true,
                dataPoints: deduplicatedData.length,
                chartType: activeChartType,
                timeframe: activeTimeframe,
                indicators: technicalIndicators.filter(i => i.enabled).length
            });

        } catch (error) {
            timer.end({ success: false, error: String(error) });
            console.error('[ENHANCED-CHART] Failed to load data:', error);
            setError(`Failed to load chart data: ${String(error)}`);
        } finally {
            setLoading(false);
        }
    }, [primary, compareId, activeTimeframe, activeChartType, technicalIndicators, comparisonMode, getChartData, calculateSMA, calculateEMA, calculateResilientRatioData, primaryColor]);

    // Effect to recreate series when chart type changes
    useEffect(() => {
        createChartSeries();
    }, [createChartSeries]);

    // Effect to load data when dependencies change
    useEffect(() => {
        if (chartRef.current) {
            loadChartData();
        }
    }, [loadChartData]);

    // Responsive resize handling
    useEffect(() => {
        function handleResize() {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ 
                    width: containerRef.current.clientWidth 
                });
            }
        }

        window.addEventListener('resize', handleResize);
        handleResize();
        
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Event handlers
    const handleTimeframeChange = useCallback((timeframe: string) => {
        setActiveTimeframe(timeframe);
        // Clear cache for this timeframe to force fresh data
        const cacheKeys = Array.from(chartDataCache.keys());
        cacheKeys.forEach(key => {
            if (key.includes(`-${timeframe}`)) {
                chartDataCache.delete(key);
            }
        });
    }, []);

    const handleChartTypeChange = useCallback((chartType: string) => {
        setActiveChartType(chartType);
    }, []);

    const handleIndicatorToggle = useCallback((indicatorKey: string) => {
        setTechnicalIndicators(prev => 
            prev.map(indicator => 
                indicator.key === indicatorKey 
                    ? { ...indicator, enabled: !indicator.enabled }
                    : indicator
            )
        );
    }, []);

    return (
        <div className="space-y-6">
            {/* Advanced Controls */}
            <AdvancedChartControls
                activeTimeframe={activeTimeframe}
                activeChartType={activeChartType}
                technicalIndicators={technicalIndicators}
                onTimeframeChange={handleTimeframeChange}
                onChartTypeChange={handleChartTypeChange}
                onIndicatorToggle={handleIndicatorToggle}
                isLoading={loading}
            />

            {/* Chart Info Bar */}
            <div className="flex items-center justify-between text-xs text-white/50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: primaryColor }}
                        />
                        <span>{comparisonMode === 'ratio' ? 'Ratio' : 'Price'} • {dataPointCount} points</span>
                    </div>
                    {technicalIndicators.filter(i => i.enabled).length > 0 && (
                        <div className="flex items-center gap-2">
                            <span>Indicators:</span>
                            {technicalIndicators.filter(i => i.enabled).map(indicator => (
                                <div key={indicator.key} className="flex items-center gap-1">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: indicator.color }}
                                    />
                                    <span>{indicator.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {error && (
                    <div className="text-red-400 text-xs">
                        {error}
                    </div>
                )}
            </div>

            {/* Chart Container */}
            <div 
                ref={containerRef} 
                className="w-full relative rounded-2xl overflow-hidden border border-white/[0.05] bg-black/20 backdrop-blur-sm"
                style={{ minHeight: '450px' }}
            >
                {loading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 backdrop-blur-sm">
                        <div className="flex items-center gap-3 text-sm text-white/70">
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                            <span>Loading enhanced chart...</span>
                        </div>
                    </div>
                )}

                {/* Empty data state */}
                {!loading && !error && dataPointCount === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="text-center p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-sm max-w-md">
                            <div className="text-white/60 text-sm font-medium mb-2">No Chart Data</div>
                            <div className="text-white/40 text-xs mb-4">
                                Price data is not available for the selected timeframe
                            </div>
                            <button
                                onClick={() => loadChartData()}
                                className="px-4 py-2 text-xs bg-white/[0.05] hover:bg-white/[0.1] text-white/70 rounded-xl transition-colors duration-200"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {error && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="text-center p-6 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm max-w-md">
                            <div className="text-red-400 text-sm font-medium mb-2">Chart Error</div>
                            <div className="text-red-300/80 text-xs mb-4">{error}</div>
                            <button
                                onClick={() => loadChartData()}
                                className="px-4 py-2 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-colors duration-200"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}