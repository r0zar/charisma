"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { TrendingUp, TrendingDown, DollarSign, Target, Activity, BarChart3, Zap, Terminal } from 'lucide-react';
import TokenLogo from '../TokenLogo';

interface PortfolioPnLData {
  portfolio: {
    currentValue: number;
    change24h: {
      percentage: number;
      usdValue: number;
    };
    topHoldings: Array<{
      contractId: string;
      symbol: string;
      balance: number;
      value: number;
      price: number;
      percentageOfPortfolio: number;
    }>;
  };
  trading: {
    tradingVolume: number;
    metrics: {
      tradingPnL: {
        percentage: number;
        usdValue: number;
      };
      totalPositions: number;
      profitablePositions: number;
      winRate: number;
    };
  };
  // Legacy compatibility
  totalInvested?: number;
  currentValue?: number;
  metrics?: any;
}

interface PortfolioPnLWidgetProps {
  className?: string;
  uiStyle?: UIStyle;
}

type UIStyle = 'dashboard' | 'command' | 'terminal';

export const PortfolioPnLWidget: React.FC<PortfolioPnLWidgetProps> = ({ className = '', uiStyle: externalUIStyle }) => {
  const { address: userAddress, connected } = useWallet();
  const [portfolioData, setPortfolioData] = useState<PortfolioPnLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [uiStyle, setUiStyle] = useState<UIStyle>(() => {
    // Use external prop if provided, otherwise load from localStorage
    if (externalUIStyle) {
      return externalUIStyle;
    }
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('portfolioUIStyle') as UIStyle) || 'dashboard';
    }
    return 'dashboard';
  });

  // Update internal state when external prop changes
  React.useEffect(() => {
    if (externalUIStyle) {
      setUiStyle(externalUIStyle);
    }
  }, [externalUIStyle]);

  // Real-time clock for terminal style
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handle UI style changes and persistence
  const handleStyleChange = (newStyle: UIStyle) => {
    setUiStyle(newStyle);
    if (typeof window !== 'undefined') {
      localStorage.setItem('portfolioUIStyle', newStyle);
    }
  };

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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-ink/60" />
        <span className="text-sm text-ink-muted">Loading portfolio...</span>
      </div>
    );
  }

  // Don't render if error or no data
  if (error || !portfolioData) {
    return null;
  }

  const { portfolio, trading } = portfolioData;
  const is24hProfit = portfolio.change24h.usdValue >= 0;
  const isTradingProfit = trading.metrics.tradingPnL.usdValue >= 0;

  const tradingPnlPercentage = Math.abs(trading.metrics.tradingPnL.percentage).toFixed(2);
  const tradingPnlUsd = Math.abs(trading.metrics.tradingPnL.usdValue).toFixed(2);

  const portfolioChange24hPercentage = Math.abs(portfolio.change24h.percentage).toFixed(2);
  const portfolioChange24hUsd = Math.abs(portfolio.change24h.usdValue).toFixed(2);


  // Dashboard Style (Clean grid with ranking badges)
  const renderDashboardStyle = () => (
    <div className="relative rounded-2xl border border-line bg-surface backdrop-blur-sm hover:bg-chrome hover:border-line-strong transition-all duration-300 p-6">
      <div className="bg-gradient-to-br from-surface-sunken to-transparent absolute inset-0 rounded-2xl pointer-events-none" />

      {/* Portfolio Header */}
      <div className="relative flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-accent/[0.08] border border-accent/[0.15]">
            <DollarSign className="w-5 h-5 text-accent-text" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Portfolio Overview</h2>
            <p className="text-ink-muted text-sm">Real-time blockchain holdings</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-ink">${portfolio.currentValue.toLocaleString()}</div>
          {portfolio.change24h.usdValue !== 0 && (
            <div className={`text-lg font-medium ${is24hProfit ? 'text-success' : 'text-danger'}`}>
              {is24hProfit ? '+' : '-'}{portfolioChange24hPercentage}% 24h
            </div>
          )}
        </div>
      </div>

      {/* Top Holdings with Ranking Badges */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {portfolio.topHoldings.slice(0, 3).map((holding, index) => (
          <div key={holding.contractId} className="bg-surface-sunken border border-line rounded-xl p-3 hover:bg-surface-hover hover:border-line-strong transition-all duration-200">
            <div className="flex items-center space-x-3 mb-2">
              <TokenLogo
                token={{
                  contractId: holding.contractId,
                  symbol: holding.symbol,
                  name: holding.name,
                  image: holding.image,
                  decimals: holding.decimals || 6,
                  type: holding.type || 'BASE'
                }}
                size="md"
              />
              <div>
                <div className="text-ink text-sm font-bold">{holding.name || holding.symbol}</div>
                <div className="text-ink-muted text-xs">{holding.symbol}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-ink font-bold">${holding.value.toLocaleString()}</div>
              <div className="text-ink-muted text-xs">{holding.percentageOfPortfolio.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Trading Performance Row */}
      <div className="grid grid-cols-3 gap-6 pt-4 border-t border-line">
        <div className="text-center">
          <div className={`text-xl font-bold ${isTradingProfit ? 'text-success' : 'text-danger'}`}>
            {isTradingProfit ? '+' : '-'}{tradingPnlPercentage}%
          </div>
          <div className="text-ink-muted text-sm">Trading P&L</div>
        </div>
        <div className="text-center">
          <div className="text-ink text-xl font-bold">${trading.tradingVolume.toLocaleString()}</div>
          <div className="text-ink-muted text-sm">Volume ({trading.metrics.totalPositions} trades)</div>
        </div>
        <div className="text-center">
          <div className="text-blaze text-xl font-bold">{trading.metrics.winRate.toFixed(1)}%</div>
          <div className="text-ink-muted text-sm">Win Rate</div>
        </div>
      </div>
    </div>
  );

  // Command Center Style (Futuristic with hexagonal badges)
  const renderCommandStyle = () => (
    <div className="relative rounded-2xl border border-line bg-surface backdrop-blur-sm hover:bg-chrome hover:border-line-strong transition-all duration-300 p-6 overflow-hidden">
      <div className="bg-gradient-to-r from-accent/[0.05] to-accent/[0.05] absolute inset-0 rounded-2xl pointer-events-none" />

      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/[0.1] to-transparent rounded-full blur-2xl"></div>

      {/* Main Stats Grid */}
      <div className="relative z-10">
        {/* Portfolio Value - Center Focus */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center space-x-4 bg-surface border border-line-strong rounded-xl px-6 py-3">
            <div className="text-4xl font-black bg-gradient-to-r from-accent to-accent bg-clip-text text-transparent">
              ${portfolio.currentValue.toLocaleString()}
            </div>
            {portfolio.change24h.usdValue !== 0 && (
              <div className={`text-lg font-medium ${is24hProfit ? 'text-success' : 'text-danger'}`}>
                {is24hProfit ? '+' : '-'}{portfolioChange24hPercentage}%
              </div>
            )}
          </div>
        </div>

        {/* Top Holdings */}
        <div className="flex justify-center items-center space-x-8 mb-6">
          {portfolio.topHoldings.slice(0, 3).map((holding, index) => (
            <div key={holding.contractId} className="text-center">
              <div className="flex flex-col items-center space-y-3">
                <TokenLogo
                  token={{
                    contractId: holding.contractId,
                    symbol: holding.symbol,
                    name: holding.name,
                    image: holding.image,
                    decimals: holding.decimals || 6,
                    type: holding.type || 'BASE'
                  }}
                  size="lg"
                />
                <div>
                  <div className="text-ink font-bold text-base">{holding.name || holding.symbol}</div>
                  <div className="text-ink-muted text-sm">{holding.symbol}</div>
                </div>
                <div>
                  <div className="text-ink-body font-medium">${holding.value.toLocaleString()}</div>
                  <div className="text-ink-muted text-sm">{holding.percentageOfPortfolio.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trading Performance Bar */}
        <div className="flex justify-center items-center bg-surface-sunken border border-line rounded-xl p-4">
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className={`text-xl font-bold ${isTradingProfit ? 'text-success' : 'text-danger'}`}>
                {isTradingProfit ? '+' : '-'}{tradingPnlPercentage}%
              </div>
              <div className="text-ink-muted text-sm">Trading P&L</div>
            </div>
            <div className="w-px h-8 bg-surface-selected"></div>
            <div className="text-center">
              <div className="text-ink text-xl font-bold">${trading.tradingVolume.toLocaleString()}</div>
              <div className="text-ink-muted text-sm">{trading.metrics.totalPositions} Trades</div>
            </div>
            <div className="w-px h-8 bg-surface-selected"></div>
            <div className="text-center">
              <div className="text-blaze text-xl font-bold">{trading.metrics.winRate.toFixed(1)}%</div>
              <div className="text-ink-muted text-sm">Win Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Terminal Style (Gaming/cyberpunk with medals)
  const renderTerminalStyle = () => (
    <div className="relative rounded-2xl border border-line bg-surface backdrop-blur-sm hover:bg-chrome hover:border-line-strong transition-all duration-300 p-6 font-mono overflow-hidden">
      <div className="bg-gradient-to-r from-success/[0.03] to-blaze/[0.03] absolute inset-0 rounded-2xl pointer-events-none" />

      {/* Animated Background Lines */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-success/50 to-transparent animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-success/50 to-transparent animate-pulse delay-1000"></div>
      </div>

      {/* Header with Portfolio Value */}
      <div className="relative z-10 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-success text-sm uppercase tracking-wider">// PORTFOLIO_OVERVIEW</div>
            <div className="text-ink text-3xl font-bold tracking-tight">${portfolio.currentValue.toLocaleString()}</div>
            {portfolio.change24h.usdValue !== 0 && (
              <div className={`text-base font-medium ${is24hProfit ? 'text-success' : 'text-danger'}`}>
                {is24hProfit ? '+' : '-'}{portfolioChange24hPercentage}% [24H_CHANGE]
              </div>
            )}
          </div>
          <div className="text-success/60 text-sm">
            REAL_TIME_DATA<br />
            {currentTime.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Top Holdings with Medal/Badge System */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {portfolio.topHoldings.slice(0, 3).map((holding, index) => (
          <div key={holding.contractId} className="relative">
            <div className="bg-surface-sunken border border-line rounded-lg p-3 hover:bg-surface-hover hover:border-success/[0.3] transition-all duration-200">
              <div className="flex items-center space-x-3 mb-2">
                <TokenLogo
                  token={{
                    contractId: holding.contractId,
                    symbol: holding.symbol,
                    name: holding.name,
                    image: holding.image,
                    decimals: holding.decimals || 6,
                    type: holding.type || 'BASE'
                  }}
                  size="md"
                />
                <div>
                  <div className="text-success text-sm font-bold">{holding.name || holding.symbol}</div>
                  <div className="text-success/60 text-xs">{holding.symbol}</div>
                </div>
              </div>
              <div className="text-ink font-bold">${holding.value.toLocaleString()}</div>
              <div className="text-success/80 text-sm">{holding.percentageOfPortfolio.toFixed(1)}% ALLOCATION</div>
            </div>
          </div>
        ))}
      </div>

      {/* Trading Performance Terminal Style */}
      <div className="border-t border-line pt-4">
        <div className="text-success text-sm mb-3">// TRADING_PERFORMANCE</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className={`text-lg font-bold ${isTradingProfit ? 'text-success' : 'text-danger'}`}>
              {isTradingProfit ? '+' : '-'}{tradingPnlPercentage}%
            </div>
            <div className="text-success/60 text-sm">P&L_RATIO</div>
          </div>
          <div>
            <div className="text-ink text-lg font-bold">${trading.tradingVolume.toLocaleString()}</div>
            <div className="text-success/60 text-sm">TOTAL_VOLUME</div>
          </div>
          <div>
            <div className="text-blaze text-lg font-bold">{trading.metrics.winRate.toFixed(1)}%</div>
            <div className="text-success/60 text-sm">WIN_RATE [{trading.metrics.profitablePositions}/{trading.metrics.totalPositions}]</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Main render function with style switching
  const renderContent = () => {
    switch (uiStyle) {
      case 'dashboard':
        return renderDashboardStyle();
      case 'command':
        return renderCommandStyle();
      case 'terminal':
        return renderTerminalStyle();
      default:
        return renderDashboardStyle();
    }
  };

  return (
    <div className={`hidden md:block transition-all duration-500 ${className}`}>
      {renderContent()}
    </div>
  );
};