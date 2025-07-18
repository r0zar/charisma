'use client';

import React from 'react';
import { BarChart3, LineChart, TrendingUp, Volume2, Activity, Settings } from 'lucide-react';

export interface ChartTimeframe {
  key: string;
  label: string;
  interval: string;
  duration: number; // seconds
}

export interface ChartType {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export interface TechnicalIndicator {
  key: string;
  label: string;
  enabled: boolean;
  color: string;
}

interface AdvancedChartControlsProps {
  activeTimeframe: string;
  activeChartType: string;
  technicalIndicators: TechnicalIndicator[];
  onTimeframeChange: (timeframe: string) => void;
  onChartTypeChange: (chartType: string) => void;
  onIndicatorToggle: (indicatorKey: string) => void;
  isLoading?: boolean;
}

// Define available timeframes with optimized intervals
export const CHART_TIMEFRAMES: ChartTimeframe[] = [
  { key: '5M', label: '5M', interval: '1m', duration: 300 },
  { key: '15M', label: '15M', interval: '1m', duration: 900 },
  { key: '1H', label: '1H', interval: '5m', duration: 3600 },
  { key: '4H', label: '4H', interval: '15m', duration: 14400 },
  { key: '1D', label: '1D', interval: '1h', duration: 86400 },
  { key: '7D', label: '7D', interval: '1h', duration: 604800 },
  { key: '30D', label: '30D', interval: '4h', duration: 2592000 },
  { key: 'ALL', label: 'ALL', interval: '1d', duration: 0 }
];

// Define chart types
export const CHART_TYPES: ChartType[] = [
  {
    key: 'line',
    label: 'Line',
    icon: LineChart,
    description: 'Clean line chart showing price movement'
  },
  {
    key: 'area',
    label: 'Area',
    icon: Activity,
    description: 'Filled area chart with gradient'
  },
  {
    key: 'candlestick',
    label: 'Candles',
    icon: BarChart3,
    description: 'OHLC candlestick chart for detailed analysis'
  },
  {
    key: 'volume',
    label: 'Volume',
    icon: Volume2,
    description: 'Price with volume overlay'
  }
];

// Default technical indicators
export const DEFAULT_INDICATORS: TechnicalIndicator[] = [
  { key: 'sma20', label: 'SMA 20', enabled: false, color: '#3b82f6' },
  { key: 'sma50', label: 'SMA 50', enabled: false, color: '#8b5cf6' },
  { key: 'ema12', label: 'EMA 12', enabled: false, color: '#10b981' },
  { key: 'ema26', label: 'EMA 26', enabled: false, color: '#f59e0b' },
  { key: 'bollinger', label: 'Bollinger', enabled: false, color: '#6b7280' },
  { key: 'rsi', label: 'RSI', enabled: false, color: '#ef4444' }
];

export default function AdvancedChartControls({
  activeTimeframe,
  activeChartType,
  technicalIndicators,
  onTimeframeChange,
  onChartTypeChange,
  onIndicatorToggle,
  isLoading = false
}: AdvancedChartControlsProps) {
  return (
    <div className="space-y-4">
      {/* Timeframe Selection */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-white/50 uppercase tracking-wider font-medium mr-2">
          Timeframe
        </div>
        <div className="flex flex-wrap gap-1">
          {CHART_TIMEFRAMES.map((timeframe) => (
            <button
              key={timeframe.key}
              onClick={() => onTimeframeChange(timeframe.key)}
              disabled={isLoading}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                activeTimeframe === timeframe.key
                  ? 'bg-white/[0.12] text-white border border-white/[0.2] shadow-sm'
                  : 'text-white/60 hover:text-white/90 hover:bg-white/[0.04] border border-transparent'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {timeframe.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Type and Indicators Row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Chart Type Selection */}
        <div className="flex items-center gap-2">
          <div className="text-xs text-white/50 uppercase tracking-wider font-medium">
            Chart
          </div>
          <div className="flex gap-1">
            {CHART_TYPES.map((chartType) => {
              const IconComponent = chartType.icon;
              return (
                <button
                  key={chartType.key}
                  onClick={() => onChartTypeChange(chartType.key)}
                  disabled={isLoading}
                  title={chartType.description}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                    activeChartType === chartType.key
                      ? 'bg-white/[0.12] text-white border border-white/[0.2]'
                      : 'text-white/60 hover:text-white/90 hover:bg-white/[0.04] border border-transparent'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span className="hidden sm:inline">{chartType.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Technical Indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs text-white/50 uppercase tracking-wider font-medium">
            Indicators
          </div>
          <div className="flex flex-wrap gap-1">
            {technicalIndicators.map((indicator) => (
              <button
                key={indicator.key}
                onClick={() => onIndicatorToggle(indicator.key)}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all duration-200 ${
                  indicator.enabled
                    ? 'bg-white/[0.12] text-white border border-white/[0.2]'
                    : 'text-white/60 hover:text-white/90 hover:bg-white/[0.04] border border-transparent'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: indicator.enabled ? indicator.color : 'transparent' }}
                />
                {indicator.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Status Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-white/50">
          <div className="w-3 h-3 border border-white/30 border-t-white/70 rounded-full animate-spin" />
          <span>Updating chart...</span>
        </div>
      )}
    </div>
  );
}

// Helper function to get timeframe configuration
export function getTimeframeConfig(timeframeKey: string): ChartTimeframe | null {
  return CHART_TIMEFRAMES.find(tf => tf.key === timeframeKey) || null;
}

// Helper function to get chart type configuration
export function getChartTypeConfig(chartTypeKey: string): ChartType | null {
  return CHART_TYPES.find(ct => ct.key === chartTypeKey) || null;
}

// Helper function to calculate data points needed for timeframe
export function calculateDataPointsNeeded(timeframe: ChartTimeframe, chartWidth: number = 800): number {
  // Target 1-2 points per pixel for smooth charts
  const basePoints = Math.floor(chartWidth / 2);
  
  // Adjust based on timeframe duration
  if (timeframe.duration === 0) return 1000; // ALL
  if (timeframe.duration <= 3600) return Math.max(basePoints, 200); // 1H or less
  if (timeframe.duration <= 86400) return Math.max(basePoints, 300); // 1D or less
  return Math.max(basePoints, 500); // 7D+
}