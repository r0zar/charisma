"use client";

import React, { useEffect, useRef } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  LineSeries,
  ColorType,
} from 'lightweight-charts';
import { ProfitabilityDataPoint } from '@/types/profitability';

interface ProfitabilityMiniChartProps {
  data: ProfitabilityDataPoint[];
  height?: number;
  className?: string;
}

export const ProfitabilityMiniChart: React.FC<ProfitabilityMiniChartProps> = ({
  data,
  height = 60,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    // Calculate if the trade is profitable or not
    const currentValue = data[data.length - 1]?.value || 0;
    const isProfit = currentValue >= 0;

    // Create chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.6)',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: { visible: false },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScroll: false,
      handleScale: false,
    });

    // Create line series with dynamic color
    const lineSeries = chart.addSeries(LineSeries, {
      color: isProfit ? '#10b981' : '#ef4444', // emerald-500 or red-500
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    }) as ISeriesApi<'Line'>;

    // Add zero line for reference
    const zeroLineSeries = chart.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.2)',
      lineWidth: 1,
      lineStyle: 2, // Dashed line
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    }) as ISeriesApi<'Line'>;

    // Convert data to chart format
    const chartData: LineData[] = data.map(point => ({
      time: point.time,
      value: point.value,
    }));

    // Create zero line data
    const zeroLineData: LineData[] = [];
    if (data.length === 1) {
      // For single data point, just use that timestamp
      zeroLineData.push({ time: data[0].time, value: 0 });
    } else {
      // For multiple data points, use start and end
      zeroLineData.push(
        { time: data[0].time, value: 0 },
        { time: data[data.length - 1].time, value: 0 }
      );
    }

    // Set data
    lineSeries.setData(chartData);
    zeroLineSeries.setData(zeroLineData);

    // Fit content
    chart.timeScale().fitContent();

    // Store references
    chartRef.current = chart;
    seriesRef.current = lineSeries;

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
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
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-white/[0.02] rounded ${className}`}
        style={{ height }}
      >
        <span className="text-xs text-white/40">No data</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`rounded ${className}`}
      style={{ height }}
    />
  );
};