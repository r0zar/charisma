"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  LineSeries,
  ColorType,
} from 'lightweight-charts';
import { ProfitabilityData, TimeRange, ProfitabilityDataPoint } from '@/types/profitability';

// Helper function to filter chart data by time range
function filterDataByTimeRange(
  data: ProfitabilityDataPoint[],
  timeRange: string
): ProfitabilityDataPoint[] {
  const now = Date.now() / 1000;
  let cutoffTime: number;
  
  switch (timeRange) {
    case '1H':
      cutoffTime = now - (60 * 60);
      break;
    case '24H':
      cutoffTime = now - (24 * 60 * 60);
      break;
    case '7D':
      cutoffTime = now - (7 * 24 * 60 * 60);
      break;
    case '30D':
      cutoffTime = now - (30 * 24 * 60 * 60);
      break;
    default:
      return data; // Return all data for 'ALL'
  }
  
  return data.filter(point => point.time >= cutoffTime);
}

interface ProfitabilityChartProps {
  data: ProfitabilityData;
  timeRange: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  height?: number;
  showControls?: boolean;
}

export const ProfitabilityChart: React.FC<ProfitabilityChartProps> = ({
  data,
  timeRange,
  onTimeRangeChange,
  height = 300,
  showControls = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [loading, setLoading] = useState(false);

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: '1H', label: '1H' },
    { value: '24H', label: '24H' },
    { value: '7D', label: '7D' },
    { value: '30D', label: '30D' },
    { value: 'ALL', label: 'ALL' }
  ];

  useEffect(() => {
    if (!containerRef.current || !data?.chartData) return;

    setLoading(true);

    // Filter data based on time range
    const filteredData = filterDataByTimeRange(data.chartData, timeRange);
    
    if (filteredData.length === 0) {
      setLoading(false);
      return;
    }

    // Calculate if the trade is profitable
    const currentValue = filteredData[filteredData.length - 1]?.value || 0;
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
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: 'rgba(255, 255, 255, 0.3)',
          style: 2,
        },
        horzLine: {
          width: 1,
          color: 'rgba(255, 255, 255, 0.3)',
          style: 2,
        },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 3,
        borderVisible: false,
      },
      localization: {
        priceFormatter: (price: number) => {
          const sign = price >= 0 ? '+' : '';
          return `${sign}${price.toFixed(1)}%`;
        },
      },
    });

    // Create main profitability line
    const lineSeries = chart.addSeries(LineSeries, {
      color: isProfit ? '#10b981' : '#ef4444',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      priceLineVisible: false,
      lastValueVisible: true,
    }) as ISeriesApi<'Line'>;

    // Add zero line for reference
    const zeroLineSeries = chart.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.3)',
      lineWidth: 1,
      lineStyle: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: true,
      lastValueVisible: false,
    }) as ISeriesApi<'Line'>;

    // Convert data to chart format
    const chartData: LineData[] = filteredData.map(point => ({
      time: point.time,
      value: point.value,
    }));

    // Create zero line data spanning the visible range
    const zeroLineData: LineData[] = [
      { time: filteredData[0].time, value: 0 },
      { time: filteredData[filteredData.length - 1].time, value: 0 }
    ];

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
    setLoading(false);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [data, timeRange, height]);

  if (!data?.chartData || data.chartData.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-white/[0.02] rounded-lg border border-white/[0.05]"
        style={{ height }}
      >
        <span className="text-sm text-white/40">No profitability data available</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time Range Controls */}
      {showControls && onTimeRangeChange && (
        <div className="flex items-center gap-2">
          {timeRangeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onTimeRangeChange(option.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                timeRange === option.value
                  ? 'bg-white/[0.08] text-white border border-white/[0.2]'
                  : 'text-white/60 hover:text-white/90 hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Chart Container */}
      <div className="relative">
        <div 
          ref={containerRef}
          className="w-full rounded-lg border border-white/[0.05] bg-black/20 overflow-hidden"
          style={{ height }}
        />
        
        {loading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm rounded-lg">
            <div className="flex items-center gap-3 text-sm text-white/70">
              <div className="h-4 w-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
              <span>Loading chart...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};