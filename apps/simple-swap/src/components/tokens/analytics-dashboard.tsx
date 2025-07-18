'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Activity, Target, Zap, AlertTriangle, Info } from 'lucide-react';
import type { TokenSummary } from '@/types/token-types';
// Analytics dashboard now uses SSR preloaded data

interface AnalyticsDashboardProps {
  token: TokenSummary;
  compareToken?: TokenSummary | null;
  preloadedAnalytics?: any;
  className?: string;
}

interface PriceStatistics {
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  averageReturn: number;
  winRate: number;
  correlation?: number;
}

interface LiquidityMetrics {
  averageVolume: number;
  volumeChange24h: number;
  liquidityScore: number;
  marketDepth: number;
}

interface RiskMetrics {
  valueAtRisk: number;
  downsideDeviation: number;
  betaCoefficient: number;
  informationRatio: number;
}

// Utility functions for statistical calculations
const calculateVolatility = (prices: number[]): number => {
  if (prices.length < 2) return 0;
  const returns = prices.slice(1).map((price, i) => Math.log(price / prices[i]));
  const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(365) * 100; // Annualized volatility
};

const calculateSharpeRatio = (prices: number[], riskFreeRate: number = 0.02): number => {
  if (prices.length < 2) return 0;
  const returns = prices.slice(1).map((price, i) => Math.log(price / prices[i]));
  const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length * 365;
  const volatility = calculateVolatility(prices) / 100;
  return volatility > 0 ? (meanReturn - riskFreeRate) / volatility : 0;
};

const calculateMaxDrawdown = (prices: number[]): number => {
  if (prices.length < 2) return 0;
  let maxDrawdown = 0;
  let peak = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
    } else {
      const drawdown = (peak - prices[i]) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }
  
  return maxDrawdown * 100;
};

const calculateCorrelation = (prices1: number[], prices2: number[]): number => {
  if (prices1.length !== prices2.length || prices1.length < 2) return 0;
  
  const returns1 = prices1.slice(1).map((price, i) => Math.log(price / prices1[i]));
  const returns2 = prices2.slice(1).map((price, i) => Math.log(price / prices2[i]));
  
  const mean1 = returns1.reduce((sum, ret) => sum + ret, 0) / returns1.length;
  const mean2 = returns2.reduce((sum, ret) => sum + ret, 0) / returns2.length;
  
  const numerator = returns1.reduce((sum, ret1, i) => sum + (ret1 - mean1) * (returns2[i] - mean2), 0);
  const denominator1 = Math.sqrt(returns1.reduce((sum, ret) => sum + Math.pow(ret - mean1, 2), 0));
  const denominator2 = Math.sqrt(returns2.reduce((sum, ret) => sum + Math.pow(ret - mean2, 2), 0));
  
  return denominator1 * denominator2 > 0 ? numerator / (denominator1 * denominator2) : 0;
};

export default function AnalyticsDashboard({ token, compareToken, preloadedAnalytics, className }: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use preloaded analytics data from SSR

  // Use preloaded analytics or fall back to defaults
  const priceStats = useMemo((): PriceStatistics => {
    if (preloadedAnalytics) {
      return {
        volatility: preloadedAnalytics.volatility || 0,
        sharpeRatio: preloadedAnalytics.sharpeRatio || 0,
        maxDrawdown: preloadedAnalytics.maxDrawdown || 0,
        averageReturn: preloadedAnalytics.averageReturn || 0,
        winRate: preloadedAnalytics.winRate || 0,
        correlation: undefined // TODO: Calculate correlation with compare token
      };
    }

    // Fallback if no preloaded data
    return {
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      averageReturn: 0,
      winRate: 0,
      correlation: undefined
    };
  }, [preloadedAnalytics]);

  // Mock liquidity and risk metrics (would be calculated from real market data)
  const liquidityMetrics = useMemo((): LiquidityMetrics => ({
    averageVolume: Math.random() * 1000000,
    volumeChange24h: (Math.random() - 0.5) * 100,
    liquidityScore: Math.random() * 100,
    marketDepth: Math.random() * 500000
  }), []);

  const riskMetrics = useMemo((): RiskMetrics => ({
    valueAtRisk: Math.random() * 15,
    downsideDeviation: Math.random() * 25,
    betaCoefficient: 0.5 + Math.random() * 1.5,
    informationRatio: (Math.random() - 0.5) * 2
  }), []);

  // Determine risk level based on metrics
  const getRiskLevel = (volatility: number, maxDrawdown: number): { level: string; color: string; icon: React.ComponentType<any> } => {
    const riskScore = (volatility + maxDrawdown * 2) / 3;
    
    if (riskScore < 15) return { level: 'Low', color: 'text-emerald-400', icon: Target };
    if (riskScore < 35) return { level: 'Medium', color: 'text-yellow-400', icon: Activity };
    return { level: 'High', color: 'text-red-400', icon: AlertTriangle };
  };

  const riskAssessment = getRiskLevel(priceStats.volatility, priceStats.maxDrawdown);

  // Format numbers for display
  const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const formatNumber = (value: number, decimals: number = 2) => value.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/[0.05] rounded-lg w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-white/[0.05] rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-red-400 text-sm mb-2">Analytics Error</div>
        <div className="text-red-300/80 text-xs">{error}</div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-white/70" />
        <h3 className="text-lg font-semibold text-white/90">Market Analytics</h3>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${riskAssessment.color.replace('text-', 'bg-')}`} />
          <span className={`text-xs font-medium ${riskAssessment.color}`}>
            {riskAssessment.level} Risk
          </span>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Price Performance */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <div className="text-sm font-medium text-white/80">Performance</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Avg Return</span>
              <span className={`text-xs font-mono ${priceStats.averageReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatPercentage(priceStats.averageReturn)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Win Rate</span>
              <span className="text-xs font-mono text-white/70">{priceStats.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Sharpe Ratio</span>
              <span className="text-xs font-mono text-white/70">{priceStats.sharpeRatio.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <riskAssessment.icon className={`w-4 h-4 ${riskAssessment.color}`} />
            <div className="text-sm font-medium text-white/80">Risk Profile</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Volatility</span>
              <span className="text-xs font-mono text-white/70">{priceStats.volatility.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Max Drawdown</span>
              <span className="text-xs font-mono text-red-400">{priceStats.maxDrawdown.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/50">VaR (95%)</span>
              <span className="text-xs font-mono text-orange-400">{riskMetrics.valueAtRisk.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Liquidity Analysis */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-400" />
            <div className="text-sm font-medium text-white/80">Liquidity</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Avg Volume</span>
              <span className="text-xs font-mono text-white/70">${formatNumber(liquidityMetrics.averageVolume, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Volume Δ</span>
              <span className={`text-xs font-mono ${liquidityMetrics.volumeChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatPercentage(liquidityMetrics.volumeChange24h)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Liquidity Score</span>
              <span className="text-xs font-mono text-white/70">{liquidityMetrics.liquidityScore.toFixed(0)}/100</span>
            </div>
          </div>
        </div>

        {/* Market Statistics */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <div className="text-sm font-medium text-white/80">Market Stats</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Market Cap</span>
              <span className="text-xs font-mono text-white/70">
                ${token.marketCap ? formatNumber(token.marketCap, 0) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Beta</span>
              <span className="text-xs font-mono text-white/70">{riskMetrics.betaCoefficient.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Info Ratio</span>
              <span className={`text-xs font-mono ${riskMetrics.informationRatio >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {riskMetrics.informationRatio.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Comparison Analysis */}
        {compareToken && priceStats.correlation !== undefined && (
          <div className="p-4 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-yellow-400" />
              <div className="text-sm font-medium text-white/80">vs {compareToken.symbol}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-white/50">Correlation</span>
                <span className={`text-xs font-mono ${Math.abs(priceStats.correlation) > 0.7 ? 'text-orange-400' : 'text-white/70'}`}>
                  {priceStats.correlation.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/50">Price Ratio</span>
                <span className="text-xs font-mono text-white/70">
                  {token.price && compareToken.price ? (token.price / compareToken.price).toFixed(4) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-white/50">Relative Strength</span>
                <span className={`text-xs font-mono ${(token.change24h || 0) > (compareToken.change24h || 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(token.change24h || 0) > (compareToken.change24h || 0) ? 'Outperforming' : 'Underperforming'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Trading Signals */}
        <div className="p-4 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-cyan-400" />
            <div className="text-sm font-medium text-white/80">Signals</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Momentum</span>
              <span className={`text-xs font-mono ${(token.change24h || 0) > 5 ? 'text-emerald-400' : (token.change24h || 0) < -5 ? 'text-red-400' : 'text-white/70'}`}>
                {(token.change24h || 0) > 5 ? 'Strong Buy' : (token.change24h || 0) < -5 ? 'Strong Sell' : 'Neutral'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Volatility Signal</span>
              <span className={`text-xs font-mono ${priceStats.volatility > 50 ? 'text-orange-400' : priceStats.volatility > 25 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {priceStats.volatility > 50 ? 'High Vol' : priceStats.volatility > 25 ? 'Med Vol' : 'Low Vol'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-white/50">Trend Strength</span>
              <span className="text-xs font-mono text-white/70">
                {Math.abs(priceStats.averageReturn) > 2 ? 'Strong' : Math.abs(priceStats.averageReturn) > 0.5 ? 'Moderate' : 'Weak'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Quality Indicator */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Info className="w-3 h-3" />
        <span>Analytics based on {preloadedAnalytics?.priceCount || 0} data points • Updated every 5 minutes</span>
      </div>
    </div>
  );
}