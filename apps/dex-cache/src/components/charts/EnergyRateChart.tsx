'use client';

import React, { useEffect, useRef } from 'react';
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    LineSeries,
    ColorType,
    LineStyle
} from 'lightweight-charts';

interface EnergyRateChartProps {
    data: { timestamp: number; rate: number }[];
    height?: number;
    width?: string | number;
    className?: string;
}

export default function EnergyRateChart({
    data,
    height = 240,
    width = '100%',
    className = ''
}: EnergyRateChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current || !data.length) return;

        // Clear previous chart if exists
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
        }

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            height: height,
            width: typeof width === 'string' ? chartContainerRef.current.clientWidth : width,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: 'rgba(255, 255, 255, 0.5)',
                fontSize: 12,
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.07)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.07)' },
            },
            rightPriceScale: {
                borderVisible: false,
            },
            timeScale: {
                borderVisible: false,
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                vertLine: {
                    color: 'rgba(255, 255, 255, 0.3)',
                    style: LineStyle.Dashed,
                },
                horzLine: {
                    color: 'rgba(255, 255, 255, 0.3)',
                    style: LineStyle.Dashed,
                },
            },
        });
        chartRef.current = chart;

        // Add line series
        const series = chart.addSeries(LineSeries, {
            color: 'hsl(var(--primary))',
            lineWidth: 2,
        }) as ISeriesApi<'Line'>;
        seriesRef.current = series;

        // Format data for the chart
        const formattedData = data
            .filter(item => item.timestamp && item.rate !== undefined)
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(item => ({
                time: item.timestamp / 1000 as LineData['time'],
                value: item.rate
            }));

        // Set data
        if (formattedData.length) {
            series.setData(formattedData);
            chart.timeScale().fitContent();
        }

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth
                });
            }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
            }
        };
    }, [data, height, width]);

    if (!data || data.length === 0) {
        return (
            <div
                className={`bg-muted/20 rounded-lg flex items-center justify-center h-full ${className}`}
                style={{ height }}
            >
                <p className="text-muted-foreground text-sm">No data available</p>
            </div>
        );
    }

    return (
        <div
            ref={chartContainerRef}
            className={`bg-muted/20 rounded-lg ${className}`}
            style={{ height }}
        />
    );
} 