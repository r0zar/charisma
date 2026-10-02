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

  // Liquidity metrics - currently not available from data sources
  // Instead of showing fake data, we'll show proper error states
  const liquidityMetrics = useMemo((): LiquidityMetrics | null => {
    // TODO: Implement real liquidity data fetching
    // For now, return null to show error state instead of fake data
    return null;
  }, []);

  // Risk metrics - currently not available from data sources
  // Instead of showing fake data, we'll show proper error states
  const riskMetrics = useMemo((): RiskMetrics | null => {
    // TODO: Implement real risk metrics calculation
    // For now, return null to show error state instead of fake data
    return null;
  }, []);

  // Determine risk level based on metrics
  const getRiskLevel = (volatility: number, maxDrawdown: number): { level: string; color: string; icon: React.ComponentType<any> } => {
    const riskScore = (volatility + maxDrawdown * 2) / 3;
    
    if (riskScore < 15) return { level: 'Low', color: 'text-success', icon: Target };
    if (riskScore < 35) return { level: 'Medium', color: 'text-warning', icon: Activity };
    return { level: 'High', color: 'text-danger', icon: AlertTriangle };
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
          <div className="h-6 bg-surface rounded-lg w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-surface rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-danger text-sm mb-2">Analytics Error</div>
        <div className="text-danger/80 text-xs">{error}</div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-ink-body" />
        <h3 className="text-lg font-semibold text-ink">Market Analytics</h3>
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
        <div className="p-4 rounded-2xl border border-line bg-surface backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-success" />
            <div className="text-sm font-medium text-ink-body">Performance</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Avg Return</span>
              <span className={`text-xs font-mono ${priceStats.averageReturn >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatPercentage(priceStats.averageReturn)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Win Rate</span>
              <span className="text-xs font-mono text-ink-body">{priceStats.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Sharpe Ratio</span>
              <span className="text-xs font-mono text-ink-body">{priceStats.sharpeRatio.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="p-4 rounded-2xl border border-line bg-surface backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <riskAssessment.icon className={`w-4 h-4 ${riskAssessment.color}`} />
            <div className="text-sm font-medium text-ink-body">Risk Profile</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Volatility</span>
              <span className="text-xs font-mono text-ink-body">{priceStats.volatility.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Max Drawdown</span>
              <span className="text-xs font-mono text-danger">{priceStats.maxDrawdown.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">VaR (95%)</span>
              <span className="text-xs font-mono text-ink-muted">
                {riskMetrics ? `${riskMetrics.valueAtRisk.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Liquidity Analysis */}
        <div className="p-4 rounded-2xl border border-line bg-surface backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-accent-text" />
            <div className="text-sm font-medium text-ink-body">Liquidity</div>
          </div>
          {liquidityMetrics ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-ink-muted">Avg Volume</span>
                <span className="text-xs font-mono text-ink-body">${formatNumber(liquidityMetrics.averageVolume, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-ink-muted">Volume Δ</span>
                <span className={`text-xs font-mono ${liquidityMetrics.volumeChange24h >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatPercentage(liquidityMetrics.volumeChange24h)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-ink-muted">Liquidity Score</span>
                <span className="text-xs font-mono text-ink-body">{liquidityMetrics.liquidityScore.toFixed(0)}/100</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-xs text-ink-muted mb-1">Data not available</div>
              <div className="text-xs text-ink-faint">Liquidity metrics are not yet available for this token</div>
            </div>
          )}
        </div>

        {/* Market Statistics */}
        <div className="p-4 rounded-2xl border border-line bg-surface backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-blaze" />
            <div className="text-sm font-medium text-ink-body">Market Stats</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Market Cap</span>
              <span className="text-xs font-mono text-ink-body">
                ${token.marketCap ? formatNumber(token.marketCap, 0) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Beta</span>
              <span className="text-xs font-mono text-ink-muted">
                {riskMetrics ? riskMetrics.betaCoefficient.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Info Ratio</span>
              <span className="text-xs font-mono text-ink-muted">
                {riskMetrics ? riskMetrics.informationRatio.toFixed(2) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Comparison Analysis */}
        {compareToken && priceStats.correlation !== undefined && (
          <div className="p-4 rounded-2xl border border-line bg-surface backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-warning" />
              <div className="text-sm font-medium text-ink-body">vs {compareToken.symbol}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-ink-muted">Correlation</span>
                <span className={`text-xs font-mono ${Math.abs(priceStats.correlation) > 0.7 ? 'text-accent-text' : 'text-ink-body'}`}>
                  {priceStats.correlation.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-ink-muted">Price Ratio</span>
                <span className="text-xs font-mono text-ink-body">
                  {token.price && compareToken.price ? (token.price / compareToken.price).toFixed(4) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-ink-muted">Relative Strength</span>
                <span className={`text-xs font-mono ${(token.change24h || 0) > (compareToken.change24h || 0) ? 'text-success' : 'text-danger'}`}>
                  {(token.change24h || 0) > (compareToken.change24h || 0) ? 'Outperforming' : 'Underperforming'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Trading Signals */}
        <div className="p-4 rounded-2xl border border-line bg-surface backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-blaze" />
            <div className="text-sm font-medium text-ink-body">Signals</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Momentum</span>
              <span className={`text-xs font-mono ${(token.change24h || 0) > 5 ? 'text-success' : (token.change24h || 0) < -5 ? 'text-danger' : 'text-ink-body'}`}>
                {(token.change24h || 0) > 5 ? 'Strong Buy' : (token.change24h || 0) < -5 ? 'Strong Sell' : 'Neutral'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Volatility Signal</span>
              <span className={`text-xs font-mono ${priceStats.volatility > 50 ? 'text-accent-text' : priceStats.volatility > 25 ? 'text-warning' : 'text-success'}`}>
                {priceStats.volatility > 50 ? 'High Vol' : priceStats.volatility > 25 ? 'Med Vol' : 'Low Vol'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-ink-muted">Trend Strength</span>
              <span className="text-xs font-mono text-ink-body">
                {Math.abs(priceStats.averageReturn) > 2 ? 'Strong' : Math.abs(priceStats.averageReturn) > 0.5 ? 'Moderate' : 'Weak'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Quality Indicator */}
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Info className="w-3 h-3" />
        <span>Analytics based on {preloadedAnalytics?.priceCount || 0} data points • Updated every 5 minutes</span>
      </div>
    </div>
  );
}