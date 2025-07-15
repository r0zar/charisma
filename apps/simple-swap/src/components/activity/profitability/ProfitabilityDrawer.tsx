"use client";

import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, Clock, Target, BarChart3, ChevronUp, ChevronDown } from 'lucide-react';
import { ProfitabilityData, TimeRange } from '@/types/profitability';
import { ProfitabilityChart } from './ProfitabilityChart';
import { ProfitabilityMetricsComponent } from './ProfitabilityMetrics';
import { ProfitabilityMiniChart } from './ProfitabilityMiniChart';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface ProfitabilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: ProfitabilityData;
  tokenPair: {
    inputSymbol: string;
    outputSymbol: string;
  };
}

export const ProfitabilityDrawer: React.FC<ProfitabilityDrawerProps> = ({
  isOpen,
  onClose,
  data,
  tokenPair
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7D');

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const formatUsd = (value: number) => {
    const sign = value >= 0 ? '+$' : '-$';
    return `${sign}${Math.abs(value).toFixed(2)}`;
  };

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={onClose}
      direction="bottom"
    >
      <DrawerContent className="bg-gray-900/95 backdrop-blur-xl border-white/[0.08]">
        {/* Hidden title for accessibility */}
        <DrawerTitle className="sr-only">
          Trade Profitability Analysis for {tokenPair.inputSymbol} to {tokenPair.outputSymbol}
        </DrawerTitle>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Trade Profitability</h2>
              <p className="text-sm text-white/60">
                {tokenPair.inputSymbol} → {tokenPair.outputSymbol}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-colors text-white/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Section */}
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Profitability Over Time</h3>
                <div 
                  className="select-none"
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <ProfitabilityChart
                    data={data}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    height={400}
                    showControls={true}
                  />
                </div>
              </div>

              {/* Token Breakdown */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Token Performance Breakdown</h3>
                <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.05]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-400" />
                        <span className="text-white/80">{tokenPair.inputSymbol} (Input)</span>
                      </div>
                      <span className={`font-medium ${data.tokenBreakdown.inputTokenChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPercentage(data.tokenBreakdown.inputTokenChange)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-400" />
                        <span className="text-white/80">{tokenPair.outputSymbol} (Output)</span>
                      </div>
                      <span className={`font-medium ${data.tokenBreakdown.outputTokenChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPercentage(data.tokenBreakdown.outputTokenChange)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-white/[0.08]">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">Net Effect</span>
                        <span className={`font-bold ${data.tokenBreakdown.netEffect >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatPercentage(data.tokenBreakdown.netEffect)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Section */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Performance Metrics</h3>
                <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.05]">
                  <ProfitabilityMetricsComponent metrics={data.metrics} compact={false} />
                </div>
              </div>

              {/* Quick Stats */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Quick Stats</h3>
                <div className="space-y-3">
                  {/* Current Status */}
                  <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.05]">
                    <div className="flex items-center gap-3 mb-3">
                      {data.metrics.currentPnL.percentage >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      )}
                      <span className="text-white/80 font-medium">Current Status</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${data.metrics.currentPnL.percentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPercentage(data.metrics.currentPnL.percentage)}
                      </div>
                      <div className={`text-sm ${data.metrics.currentPnL.percentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatUsd(data.metrics.currentPnL.usdValue)}
                      </div>
                    </div>
                  </div>

                  {/* Time Held */}
                  <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.05]">
                    <div className="flex items-center gap-3 mb-3">
                      <Clock className="w-5 h-5 text-blue-400" />
                      <span className="text-white/80 font-medium">Time Held</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-lg font-semibold">
                        {Math.floor(data.metrics.timeHeld / (1000 * 60 * 60 * 24))}d{' '}
                        {Math.floor((data.metrics.timeHeld % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}h
                      </div>
                    </div>
                  </div>

                  {/* Performance Range */}
                  <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.05]">
                    <div className="flex items-center gap-3 mb-3">
                      <Target className="w-5 h-5 text-yellow-400" />
                      <span className="text-white/80 font-medium">Range</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-white/60 text-sm">High</span>
                        <span className="text-emerald-400 font-medium">
                          {formatPercentage(data.metrics.bestPerformance.percentage)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60 text-sm">Low</span>
                        <span className="text-red-400 font-medium">
                          {formatPercentage(data.metrics.worstPerformance.percentage)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};