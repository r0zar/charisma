"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    ColorType,
} from "lightweight-charts";
import { TokenCacheData } from "@/lib/contract-registry-adapter";
import { Loader2, AlertCircle } from "lucide-react";
import { calculateSimpleRatio, cleanPriceData, formatPrice } from "@/lib/charts/simple-chart-utils";
import { usePriceSeriesService } from '@/lib/charts/price-series-service';

interface Props {
    token: TokenCacheData;
    baseToken?: TokenCacheData | null;
    height?: number;
    timeframe?: string;
}

/**
 * Simplified token chart that eliminates unnecessary data transformations
 * Uses LineData directly from PriceSeriesService
 */
export function SimpleTokenChart({ 
    token, 
    baseToken, 
    height = 220,
    timeframe = '24h'
}: Props) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const priceSeriesService = usePriceSeriesService();

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: 'rgba(255, 255, 255, 0.7)',
                fontSize: 11,
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
            },
            crosshair: {
                mode: 1,
                vertLine: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    width: 1,
                    style: 0,
                },
                horzLine: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    width: 1,
                    style: 0,
                },
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                textColor: 'rgba(255, 255, 255, 0.7)',
            },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                textColor: 'rgba(255, 255, 255, 0.7)',
                timeVisible: true,
                secondsVisible: false,
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
        });

        const series = chart.addLineSeries({
            color: '#3b82f6',
            lineWidth: 2,
            priceFormat: {
                type: 'price',
                precision: 4,
                minMove: 0.0001,
            },
        });

        chartRef.current = chart;
        seriesRef.current = series;

        // Handle resize
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
            const { width, height } = entries[0].contentRect;
            chart.applyOptions({ width, height });
        });

        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, []);

    // Load chart data
    const loadChartData = useCallback(async () => {
        if (!token?.contractId || !seriesRef.current) return;

        setLoading(true);
        setError(null);

        try {
            // Fetch price series data
            let chartData: LineData[];

            if (baseToken?.contractId) {
                // Fetch both token and base data for ratio calculation
                const [tokenData, baseData] = await Promise.all([
                    priceSeriesService.fetchSingleSeries(token.contractId, timeframe),
                    priceSeriesService.fetchSingleSeries(baseToken.contractId, timeframe)
                ]);

                // Calculate simple ratio
                const cleanTokenData = cleanPriceData(tokenData);
                const cleanBaseData = cleanPriceData(baseData);
                chartData = calculateSimpleRatio(cleanTokenData, cleanBaseData);
            } else {
                // Single token chart
                const tokenData = await priceSeriesService.fetchSingleSeries(token.contractId, timeframe);
                chartData = cleanPriceData(tokenData);
            }

            // Update chart with data
            if (chartData.length > 0) {
                seriesRef.current.setData(chartData);
                
                // Fit chart to data
                setTimeout(() => {
                    chartRef.current?.timeScale().fitContent();
                }, 100);
            } else {
                setError('No price data available');
            }

        } catch (err) {
            console.error('Chart data loading error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load chart data');
        } finally {
            setLoading(false);
        }
    }, [token?.contractId, baseToken?.contractId, timeframe]);

    // Load data when component mounts or dependencies change
    useEffect(() => {
        loadChartData();
    }, [loadChartData]);

    if (loading) {
        return (
            <div 
                className="flex items-center justify-center bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm rounded-lg"
                style={{ height }}
            >
                <div className="flex items-center space-x-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading chart...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div 
                className="flex flex-col items-center justify-center bg-white/[0.03] border border-red-500/[0.15] rounded-lg space-y-3"
                style={{ height }}
            >
                <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Chart Error</span>
                </div>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 text-center max-w-xs">
                    {error}
                </p>
                <button
                    onClick={loadChartData}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div 
            ref={chartContainerRef}
            className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm rounded-lg"
            style={{ height }}
        />
    );
}