"use client";

import React from 'react';
import { ProfitabilityMetrics } from '@/types/profitability';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ProfitabilityMetricsProps {
  metrics: ProfitabilityMetrics;
  compact?: boolean;
}

export const ProfitabilityMetricsComponent: React.FC<ProfitabilityMetricsProps> = ({
  metrics,
  compact = false
}) => {
  const { currentPnL, bestPerformance, worstPerformance } = metrics;
  
  // Determine colors and icons based on P&L
  const isProfit = currentPnL.percentage >= 0;
  const isSignificant = Math.abs(currentPnL.percentage) >= 1; // More than 1%
  
  const getColorClass = (value: number) => {
    if (value > 0) return 'text-success';
    if (value < 0) return 'text-danger';
    return 'text-ink-muted';
  };
  
  const getIcon = (value: number) => {
    if (value > 0) return TrendingUp;
    if (value < 0) return TrendingDown;
    return Minus;
  };
  
  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };
  
  const formatUsd = (value: number) => {
    const sign = value >= 0 ? '+$' : '-$';
    return `${sign}${Math.abs(value).toFixed(2)}`;
  };
  
  const formatTimeHeld = (milliseconds: number) => {
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  };

  if (compact) {
    const CurrentIcon = getIcon(currentPnL.percentage);
    
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CurrentIcon className={`w-4 h-4 ${getColorClass(currentPnL.percentage)}`} />
          <span className="text-ink-muted text-sm">Current P&L:</span>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${getColorClass(currentPnL.percentage)}`}>
            {formatPercentage(currentPnL.percentage)}
          </div>
          <div className={`text-xs ${getColorClass(currentPnL.percentage)}`}>
            {formatUsd(currentPnL.usdValue)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current P&L */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isProfit ? 'bg-success/10' : 'bg-danger/10'}`}>
            {React.createElement(getIcon(currentPnL.percentage), {
              className: `w-5 h-5 ${getColorClass(currentPnL.percentage)}`
            })}
          </div>
          <div>
            <div className="text-ink font-medium">Current P&L</div>
            <div className="text-ink-muted text-sm">
              Held for {formatTimeHeld(metrics.timeHeld)}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${getColorClass(currentPnL.percentage)}`}>
            {formatPercentage(currentPnL.percentage)}
          </div>
          <div className={`text-sm ${getColorClass(currentPnL.percentage)}`}>
            {formatUsd(currentPnL.usdValue)}
          </div>
        </div>
      </div>

      {/* Performance Range */}
      <div className="space-y-3">
        <div className="text-ink-muted text-sm font-medium">Performance Range</div>
        
        {/* Best Performance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="text-ink-body text-sm">Best</span>
          </div>
          <div className="text-right">
            <div className="text-success font-medium">
              {formatPercentage(bestPerformance.percentage)}
            </div>
            <div className="text-success text-xs">
              {formatUsd(bestPerformance.usdValue)}
            </div>
          </div>
        </div>

        {/* Worst Performance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-danger" />
            <span className="text-ink-body text-sm">Worst</span>
          </div>
          <div className="text-right">
            <div className="text-danger font-medium">
              {formatPercentage(worstPerformance.percentage)}
            </div>
            <div className="text-danger text-xs">
              {formatUsd(worstPerformance.usdValue)}
            </div>
          </div>
        </div>

        {/* Average Return */}
        <div className="flex items-center justify-between pt-2 border-t border-line">
          <span className="text-ink-body text-sm">Average Return</span>
          <div className={`font-medium ${getColorClass(metrics.averageReturn)}`}>
            {formatPercentage(metrics.averageReturn)}
          </div>
        </div>
      </div>
    </div>
  );
};