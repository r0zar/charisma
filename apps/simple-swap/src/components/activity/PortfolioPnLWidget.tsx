"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { TrendingUp, TrendingDown, DollarSign, Target, Activity } from 'lucide-react';

interface PortfolioPnLData {
  metrics: {
    totalPnL: {
      percentage: number;
      usdValue: number;
    };
    totalPositions: number;
    profitablePositions: number;
    winRate: number;
  };
  totalInvested: number;
  currentValue: number;
}

interface PortfolioPnLWidgetProps {
  className?: string;
}

export const PortfolioPnLWidget: React.FC<PortfolioPnLWidgetProps> = ({ className = '' }) => {
  const { address: userAddress, connected } = useWallet();
  const [portfolioData, setPortfolioData] = useState<PortfolioPnLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolioData = async () => {
      if (!connected || !userAddress) {
        setPortfolioData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_TX_MONITOR_URL || 'http://localhost:3012'}/api/v1/activities/profitability/portfolio?owner=${userAddress}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            // No portfolio data available
            setPortfolioData(null);
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success && result.data) {
          setPortfolioData(result.data);
        } else {
          setPortfolioData(null);
        }
      } catch (err) {
        console.error('Error fetching portfolio P&L:', err);
        setError(err instanceof Error ? err.message : 'Failed to load portfolio data');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioData();
  }, [connected, userAddress]);

  // Don't render if no wallet connected
  if (!connected || !userAddress) {
    return null;
  }

  // Don't render if loading and no data
  if (loading && !portfolioData) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        <span className="text-sm text-white/60">Loading portfolio...</span>
      </div>
    );
  }

  // Don't render if error or no data
  if (error || !portfolioData) {
    return null;
  }

  const { metrics, totalInvested, currentValue } = portfolioData;
  const isProfit = metrics.totalPnL.usdValue >= 0;
  const percentageFormatted = Math.abs(metrics.totalPnL.percentage).toFixed(2);
  const usdFormatted = Math.abs(metrics.totalPnL.usdValue).toFixed(2);

  return (
    <div className={`flex items-center space-x-8 ${className}`}>
      {/* Total P&L Display */}
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-xl ${isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          {isProfit ? (
            <TrendingUp className={`w-5 h-5 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`} />
          ) : (
            <TrendingDown className={`w-5 h-5 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`} />
          )}
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Total P&L</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className={`text-lg font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
              {isProfit ? '+' : '-'}{percentageFormatted}%
            </span>
            <span className={`text-sm ${isProfit ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
              {isProfit ? '+' : '-'}${usdFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Portfolio Value */}
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-xl bg-blue-500/10">
          <DollarSign className="w-5 h-5 text-blue-400" />
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Portfolio Value</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-lg font-semibold text-white/90">
              ${currentValue.toFixed(0)}
            </span>
            <span className="text-sm text-white/60">
              invested ${totalInvested.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* Win Rate */}
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-xl bg-purple-500/10">
          <Target className="w-5 h-5 text-purple-400" />
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Win Rate</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-lg font-semibold text-white/90">
              {metrics.winRate.toFixed(1)}%
            </span>
            <span className="text-sm text-white/60">
              {metrics.profitablePositions}/{metrics.totalPositions}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};