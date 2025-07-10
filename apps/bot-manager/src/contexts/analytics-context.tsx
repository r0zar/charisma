'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type {
  AnalyticsSummary,
  PerformanceMetrics,
  PortfolioHolding,
  ProcessedTransaction,
  YieldFarmingAnalytics,
  MarketOpportunity,
  AnalyticsConfig,
  CacheStats
} from '@/lib/analytics-types';
import { cachedAnalyticsClient, CachedAnalyticsClient } from '@/lib/analytics-client-cached';
import { useNotifications } from './notification-context';

interface AnalyticsContextType {
  // Data
  analyticsSummary: AnalyticsSummary | null;
  performanceMetrics: PerformanceMetrics | null;
  portfolioHoldings: PortfolioHolding[];
  recentTransactions: ProcessedTransaction[];
  yieldFarmingAnalytics: YieldFarmingAnalytics | null;
  marketOpportunities: MarketOpportunity[];
  
  // State
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Configuration
  config: AnalyticsConfig;
  cacheStats: CacheStats;
  
  // Actions
  refreshAnalytics: (walletAddress?: string) => Promise<void>;
  refreshPerformanceMetrics: (walletAddress?: string, startingValue?: number) => Promise<void>;
  refreshPortfolioHoldings: (walletAddress?: string) => Promise<void>;
  refreshYieldAnalytics: (walletAddress?: string) => Promise<void>;
  refreshMarketOpportunities: (walletAddress?: string) => Promise<void>;
  
  // Configuration
  updateConfig: (newConfig: Partial<AnalyticsConfig>) => void;
  clearCache: () => Promise<void>;
  
  // Utilities
  setWalletAddress: (address: string) => void;
  getWalletAddress: () => string | null;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};

interface AnalyticsProviderProps {
  children: ReactNode;
  defaultWalletAddress?: string;
  customConfig?: Partial<AnalyticsConfig>;
}

export function AnalyticsProvider({ 
  children, 
  defaultWalletAddress,
  customConfig 
}: AnalyticsProviderProps) {
  const { showSuccess, showError } = useNotifications();
  
  // State
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [portfolioHoldings, setPortfolioHoldings] = useState<PortfolioHolding[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<ProcessedTransaction[]>([]);
  const [yieldFarmingAnalytics, setYieldFarmingAnalytics] = useState<YieldFarmingAnalytics | null>(null);
  const [marketOpportunities, setMarketOpportunities] = useState<MarketOpportunity[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(defaultWalletAddress || null);
  
  // Analytics client instance (cached)
  const [client] = useState(() => {
    return cachedAnalyticsClient;
  });
  
  const [config, setConfig] = useState<AnalyticsConfig>({
    cacheEnabled: true,
    cacheTTL: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 1000
  });
  const [cacheStats, setCacheStats] = useState<CacheStats>(client.getCacheStats());

  /**
   * Refresh analytics summary
   */
  const refreshAnalytics = useCallback(async (address?: string) => {
    const targetAddress = address || walletAddress;
    if (!targetAddress) {
      setError('No wallet address provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await client.getAnalyticsSummary(targetAddress);
      
      if (response.success && response.data) {
        setAnalyticsSummary(response.data);
        
        // Also update related data from the summary
        setPerformanceMetrics(response.data.performance);
        setPortfolioHoldings(response.data.holdings);
        setRecentTransactions(response.data.recentTransactions);
        
        setLastUpdated(new Date());
        
        if (!response.metadata?.cached) {
          // Check if this is empty data (new wallet)
          if (response.metadata?.source === 'empty') {
            showSuccess('No transaction history found - this appears to be a new wallet');
          } else if (response.data.recentTransactions.length === 0) {
            showSuccess('Analytics updated - no recent transactions found');
          } else {
            showSuccess('Analytics updated with latest blockchain data');
          }
        }
      } else {
        throw new Error(response.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh analytics';
      setError(errorMessage);
      showError(`Analytics refresh failed: ${errorMessage}`);
    } finally {
      setLoading(false);
      setCacheStats(client.getCacheStats());
    }
  }, [walletAddress, client, showSuccess, showError]);

  /**
   * Refresh performance metrics only
   */
  const refreshPerformanceMetrics = useCallback(async (address?: string, startingValue?: number) => {
    const targetAddress = address || walletAddress;
    if (!targetAddress) {
      setError('No wallet address provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await client.getPerformanceMetrics(targetAddress);
      
      if (response.success && response.data) {
        setPerformanceMetrics(response.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(response.error || 'Failed to fetch performance metrics');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh performance metrics';
      setError(errorMessage);
      showError(`Performance metrics refresh failed: ${errorMessage}`);
    } finally {
      setLoading(false);
      setCacheStats(client.getCacheStats());
    }
  }, [walletAddress, client, showError]);

  /**
   * Refresh portfolio holdings only
   */
  const refreshPortfolioHoldings = useCallback(async (address?: string) => {
    const targetAddress = address || walletAddress;
    if (!targetAddress) {
      setError('No wallet address provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await client.getPortfolioHoldings(targetAddress);
      
      if (response.success && response.data) {
        setPortfolioHoldings(response.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(response.error || 'Failed to fetch portfolio holdings');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh portfolio holdings';
      setError(errorMessage);
      showError(`Portfolio refresh failed: ${errorMessage}`);
    } finally {
      setLoading(false);
      setCacheStats(client.getCacheStats());
    }
  }, [walletAddress, client, showError]);

  /**
   * Refresh yield farming analytics
   */
  const refreshYieldAnalytics = useCallback(async (address?: string) => {
    const targetAddress = address || walletAddress;
    if (!targetAddress) {
      setError('No wallet address provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await client.getYieldFarmingAnalytics(targetAddress);
      
      if (response.success && response.data) {
        setYieldFarmingAnalytics(response.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(response.error || 'Failed to fetch yield farming analytics');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh yield analytics';
      setError(errorMessage);
      showError(`Yield analytics refresh failed: ${errorMessage}`);
    } finally {
      setLoading(false);
      setCacheStats(client.getCacheStats());
    }
  }, [walletAddress, client, showError]);

  /**
   * Refresh market opportunities
   */
  const refreshMarketOpportunities = useCallback(async (address?: string) => {
    const targetAddress = address || walletAddress;
    if (!targetAddress) {
      setError('No wallet address provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await client.getMarketOpportunities(targetAddress);
      
      if (response.success && response.data) {
        setMarketOpportunities(response.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(response.error || 'Failed to fetch market opportunities');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh market opportunities';
      setError(errorMessage);
      showError(`Market opportunities refresh failed: ${errorMessage}`);
    } finally {
      setLoading(false);
      setCacheStats(client.getCacheStats());
    }
  }, [walletAddress, client, showError]);

  /**
   * Update analytics configuration (cached client doesn't support config updates)
   */
  const updateConfig = useCallback((newConfig: Partial<AnalyticsConfig>) => {
    // Update local config state for UI purposes
    setConfig(prevConfig => ({ ...prevConfig, ...newConfig }));
    
    // Update cache stats
    setCacheStats(client.getCacheStats());
  }, [client]);

  /**
   * Clear all caches (cached client doesn't support cache clearing)
   */
  const clearCache = useCallback(async () => {
    try {
      await client.clearCache();
      setCacheStats(client.getCacheStats());
      showSuccess('Cache clear request sent (processed server-side)');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear cache';
      showError(`Cache clear failed: ${errorMessage}`);
    }
  }, [client, showSuccess, showError]);

  /**
   * Set wallet address and refresh analytics
   */
  const setWalletAddressAndRefresh = useCallback((address: string) => {
    setWalletAddress(address);
    // Don't auto-refresh here, let the component decide when to refresh
  }, []);

  /**
   * Get current wallet address
   */
  const getWalletAddress = useCallback(() => {
    return walletAddress;
  }, [walletAddress]);

  // Note: Auto-refresh and intervals removed - analytics now processed via cron jobs
  // Data is served from cache, reducing page load times from 3-10 seconds to instant

  const contextValue: AnalyticsContextType = {
    // Data
    analyticsSummary,
    performanceMetrics,
    portfolioHoldings,
    recentTransactions,
    yieldFarmingAnalytics,
    marketOpportunities,
    
    // State
    loading,
    error,
    lastUpdated,
    
    // Configuration
    config,
    cacheStats,
    
    // Actions
    refreshAnalytics,
    refreshPerformanceMetrics,
    refreshPortfolioHoldings,
    refreshYieldAnalytics,
    refreshMarketOpportunities,
    
    // Configuration
    updateConfig,
    clearCache,
    
    // Utilities
    setWalletAddress: setWalletAddressAndRefresh,
    getWalletAddress,
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
}