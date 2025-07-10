/**
 * Analytics API Client
 * Clean interfaces for fetching and caching analytics data
 */

import { kv } from '@vercel/kv';
import type {
  AnalyticsSummary,
  PerformanceMetrics,
  PortfolioHolding,
  ProcessedTransaction,
  YieldFarmingAnalytics,
  MarketOpportunity,
  AnalyticsConfig,
  AnalyticsApiResponse,
  CacheEntry,
  CacheStats
} from './analytics-types';
import {
  generateAnalyticsSummary,
  calculatePerformanceMetrics,
  calculatePortfolioHoldings,
  processTransactionEvents,
  analyzeYieldFarming,
  detectMarketOpportunities,
  DEFAULT_ANALYTICS_CONFIG
} from './analytics-engine';
import { getTransactionEvents } from '@repo/polyglot';
import { getPrices } from '@repo/tokens';

/**
 * Analytics API Client Class
 */
export class AnalyticsClient {
  private config: AnalyticsConfig;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: 1000,
    hitRate: 0,
  };

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
  }

  /**
   * Get comprehensive analytics summary for a wallet
   */
  async getAnalyticsSummary(walletAddress: string): Promise<AnalyticsApiResponse<AnalyticsSummary>> {
    const cacheKey = `analytics:summary:${walletAddress}`;
    
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = await this.getFromCache<AnalyticsSummary>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached,
            metadata: {
              timestamp: Date.now(),
              cached: true,
              source: 'cache',
            },
          };
        }
      }

      // Generate fresh analytics by calling getTransactionEvents directly
      // First try direct import, then dynamic import as fallback
      let eventsResponse;
      
      try {
        eventsResponse = await getTransactionEvents({
          address: walletAddress,
          limit: 100,
        });
        
        // If response is undefined, try dynamic import
        if (!eventsResponse) {
          console.log('Direct import returned undefined, trying dynamic import...');
          const { getTransactionEvents: dynamicGetTransactionEvents } = await import('@repo/polyglot');
          eventsResponse = await dynamicGetTransactionEvents({
            address: walletAddress,
            limit: 100,
          });
        }
      } catch (importError) {
        console.log('Import error, trying dynamic import fallback:', importError);
        const { getTransactionEvents: dynamicGetTransactionEvents } = await import('@repo/polyglot');
        eventsResponse = await dynamicGetTransactionEvents({
          address: walletAddress,
          limit: 100,
        });
      }
      
      console.log('Events response in client:', typeof eventsResponse, eventsResponse?.events?.length);
      
      if (!eventsResponse || !eventsResponse.events || eventsResponse.events.length === 0) {
        console.log(`ℹ️ No transaction events found for wallet ${walletAddress} - returning empty summary`);
        
        // Return a valid empty summary for new wallets
        const emptySummary: AnalyticsSummary = {
          portfolio: {
            totalValue: 0,
            totalChange: 0,
            totalChangePercent: 0,
          },
          performance: {
            totalReturn: 0,
            totalReturnPercent: 0,
            totalTrades: 0,
            winRate: 0,
            currentValue: 0,
            startingValue: 0,
            totalFeesSpent: 0,
            totalYieldEarned: 0,
            averageTradeSize: 0,
            profitableTrades: 0,
            losingTrades: 0,
            largestWin: 0,
            largestLoss: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            averageHoldingPeriod: 0,
            riskAdjustedReturn: 0,
          },
          holdings: [],
          recentTransactions: [],
          valueHistory: [],
          pnlHistory: [],
          strategies: {},
          topGainers: [],
          topLosers: [],
          marketOpportunities: [],
          yieldFarmingStats: {
            totalEnergySpent: 0,
            totalHootReceived: 0,
            conversionRate: 0,
            averageConversionTime: 0,
            totalConversions: 0,
            estimatedApy: 0,
          },
          lastUpdated: Date.now(),
          dataQuality: {
            completeness: 100, // 100% complete for empty data
            confidence: 100,
            lastDataPoint: Date.now(),
            missingDataRanges: [],
            estimatedDataPoints: 0,
          },
        };

        // Cache the empty result
        if (this.config.cacheEnabled) {
          await this.setCache(cacheKey, emptySummary, this.config.cacheTTL);
        }

        return {
          success: true,
          data: emptySummary,
          metadata: {
            timestamp: Date.now(),
            cached: false,
            source: 'empty',
          },
        };
      }
      
      // Process the events using the analytics engine functions
      const transactions = await processTransactionEvents(eventsResponse.events, this.config);
      const performance = calculatePerformanceMetrics(transactions, 10000, this.config);
      const holdings = await calculatePortfolioHoldings(transactions, this.config);
      
      // Build the analytics summary manually
      const summary: AnalyticsSummary = {
        portfolio: {
          totalValue: holdings.reduce((sum, h) => sum + h.usdValue, 0),
          totalChange: performance.totalReturn,
          totalChangePercent: performance.totalReturnPercent,
        },
        performance,
        holdings,
        recentTransactions: transactions.slice(-10),
        valueHistory: [],
        pnlHistory: [],
        strategies: {},
        topGainers: [],
        topLosers: [],
        marketOpportunities: [],
        yieldFarmingStats: {
          totalEnergySpent: 0,
          totalHootReceived: 0,
          totalUsdInvested: 0,
          totalUsdReturned: 0,
          totalReturn: 0,
          totalReturnPercent: 0,
          averageAPY: 0,
          totalTransactions: 0,
          activeDays: 0,
        },
        lastUpdated: new Date(),
      };
      
      // Cache the result
      if (this.config.cacheEnabled) {
        await this.setCache(cacheKey, summary, this.config.cacheTTL);
      }

      return {
        success: true,
        data: summary,
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'blockchain',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'error',
        },
      };
    }
  }

  /**
   * Get performance metrics for a wallet
   */
  async getPerformanceMetrics(
    walletAddress: string,
    startingValue?: number
  ): Promise<AnalyticsApiResponse<PerformanceMetrics>> {
    const cacheKey = `analytics:performance:${walletAddress}:${startingValue || 10000}`;
    
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = await this.getFromCache<PerformanceMetrics>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached,
            metadata: {
              timestamp: Date.now(),
              cached: true,
              source: 'cache',
            },
          };
        }
      }

      // Fetch and process transactions
      const transactions = await this.getProcessedTransactions(walletAddress);
      const metrics = calculatePerformanceMetrics(transactions, startingValue, this.config);
      
      // Cache the result
      if (this.config.cacheEnabled) {
        await this.setCache(cacheKey, metrics, this.config.cacheTTL);
      }

      return {
        success: true,
        data: metrics,
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'blockchain',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'error',
        },
      };
    }
  }

  /**
   * Get portfolio holdings for a wallet
   */
  async getPortfolioHoldings(walletAddress: string): Promise<AnalyticsApiResponse<PortfolioHolding[]>> {
    const cacheKey = `analytics:holdings:${walletAddress}`;
    
    try {
      // Check cache first (shorter TTL for holdings as prices change frequently)
      if (this.config.cacheEnabled) {
        const cached = await this.getFromCache<PortfolioHolding[]>(cacheKey, 60000); // 1 minute TTL
        if (cached) {
          return {
            success: true,
            data: cached,
            metadata: {
              timestamp: Date.now(),
              cached: true,
              source: 'cache',
            },
          };
        }
      }

      // Fetch and process transactions
      const transactions = await this.getProcessedTransactions(walletAddress);
      const holdings = await calculatePortfolioHoldings(transactions, this.config);
      
      // Cache the result
      if (this.config.cacheEnabled) {
        await this.setCache(cacheKey, holdings, 60000); // 1 minute TTL
      }

      return {
        success: true,
        data: holdings,
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'blockchain',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'error',
        },
      };
    }
  }

  /**
   * Get processed transactions for a wallet
   */
  async getProcessedTransactions(
    walletAddress: string,
    limit: number = 100
  ): Promise<ProcessedTransaction[]> {
    const cacheKey = `analytics:transactions:${walletAddress}:${limit}`;
    
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = await this.getFromCache<ProcessedTransaction[]>(cacheKey);
      if (cached) {
        this.cacheStats.hits++;
        this.updateCacheStats();
        return cached;
      }
    }

    this.cacheStats.misses++;
    this.updateCacheStats();

    // Fetch fresh transaction events
    const eventsResponse = await getTransactionEvents({
      address: walletAddress,
      limit,
    });

    // Process the events
    const transactions = await processTransactionEvents(eventsResponse.events || [], this.config);
    
    // Add USD values using current prices
    const transactionsWithPrices = await this.enrichTransactionsWithPrices(transactions);
    
    // Cache the result
    if (this.config.cacheEnabled) {
      await this.setCache(cacheKey, transactionsWithPrices, this.config.cacheTTL);
    }

    return transactionsWithPrices;
  }

  /**
   * Get yield farming analytics for a wallet
   */
  async getYieldFarmingAnalytics(walletAddress: string): Promise<AnalyticsApiResponse<YieldFarmingAnalytics>> {
    const cacheKey = `analytics:yield:${walletAddress}`;
    
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = await this.getFromCache<YieldFarmingAnalytics>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached,
            metadata: {
              timestamp: Date.now(),
              cached: true,
              source: 'cache',
            },
          };
        }
      }

      // Fetch and analyze yield farming data
      const transactions = await this.getProcessedTransactions(walletAddress);
      const yieldAnalytics = analyzeYieldFarming(transactions, this.config);
      
      // Cache the result
      if (this.config.cacheEnabled) {
        await this.setCache(cacheKey, yieldAnalytics, this.config.cacheTTL);
      }

      return {
        success: true,
        data: yieldAnalytics,
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'blockchain',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'error',
        },
      };
    }
  }

  /**
   * Get market opportunities
   */
  async getMarketOpportunities(walletAddress: string): Promise<AnalyticsApiResponse<MarketOpportunity[]>> {
    const cacheKey = `analytics:opportunities:${walletAddress}`;
    
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = await this.getFromCache<MarketOpportunity[]>(cacheKey, 300000); // 5 minute TTL
        if (cached) {
          return {
            success: true,
            data: cached,
            metadata: {
              timestamp: Date.now(),
              cached: true,
              source: 'cache',
            },
          };
        }
      }

      // Get current holdings and transactions
      const holdings = await calculatePortfolioHoldings(
        await this.getProcessedTransactions(walletAddress),
        this.config
      );
      const transactions = await this.getProcessedTransactions(walletAddress, 100); // Recent transactions
      
      // Detect opportunities
      const opportunities = await detectMarketOpportunities(holdings, transactions, this.config);
      
      // Cache the result
      if (this.config.cacheEnabled) {
        await this.setCache(cacheKey, opportunities, 300000); // 5 minute TTL
      }

      return {
        success: true,
        data: opportunities,
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'analysis',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'error',
        },
      };
    }
  }

  /**
   * Get current token prices
   */
  async getTokenPrices(tokenIds: string[]): Promise<AnalyticsApiResponse<Record<string, number>>> {
    const cacheKey = `analytics:prices:${tokenIds.sort().join(',')}`;
    
    try {
      // Check cache first (short TTL for prices)
      if (this.config.cacheEnabled) {
        const cached = await this.getFromCache<Record<string, number>>(cacheKey, 60000); // 1 minute TTL
        if (cached) {
          return {
            success: true,
            data: cached,
            metadata: {
              timestamp: Date.now(),
              cached: true,
              source: 'cache',
            },
          };
        }
      }

      // Fetch fresh prices
      const priceResponse = await getPrices(tokenIds);
      const prices = priceResponse.prices.reduce((acc, price) => {
        acc[price.contractId] = price.price;
        return acc;
      }, {} as Record<string, number>);
      
      // Cache the result
      if (this.config.cacheEnabled) {
        await this.setCache(cacheKey, prices, 60000); // 1 minute TTL
      }

      return {
        success: true,
        data: prices,
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'partykit',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: Date.now(),
          cached: false,
          source: 'error',
        },
      };
    }
  }

  /**
   * Enrich transactions with current USD prices
   */
  private async enrichTransactionsWithPrices(
    transactions: ProcessedTransaction[]
  ): Promise<ProcessedTransaction[]> {
    // Get unique token IDs
    const tokenIds = [...new Set(transactions.map(tx => tx.tokenId).filter(Boolean))];
    
    if (tokenIds.length === 0) {
      return transactions;
    }

    try {
      // Fetch current prices
      const pricesResponse = await this.getTokenPrices(tokenIds);
      const prices = pricesResponse.data || {};

      // Add USD values to transactions
      return transactions.map(tx => {
        if (tx.tokenId && tx.amount && prices[tx.tokenId]) {
          return {
            ...tx,
            usdValue: tx.amount * prices[tx.tokenId],
          };
        }
        return tx;
      });
    } catch (error) {
      console.warn('Failed to enrich transactions with prices:', error);
      return transactions;
    }
  }

  /**
   * Get item from cache
   */
  private async getFromCache<T>(key: string, customTTL?: number): Promise<T | null> {
    try {
      // Try memory cache first
      const memoryEntry = this.cache.get(key);
      if (memoryEntry && Date.now() - memoryEntry.timestamp < (customTTL || memoryEntry.ttl)) {
        return memoryEntry.data;
      }

      // Try Vercel KV cache
      const kvEntry = await kv.get<CacheEntry<T>>(key);
      if (kvEntry && Date.now() - kvEntry.timestamp < (customTTL || kvEntry.ttl)) {
        // Update memory cache
        this.cache.set(key, kvEntry);
        this.cacheStats.size = this.cache.size;
        return kvEntry.data;
      }

      return null;
    } catch (error) {
      console.warn(`Cache read error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set item in cache
   */
  private async setCache<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        key,
      };

      // Update memory cache
      this.cache.set(key, entry);
      this.cacheStats.size = this.cache.size;

      // Clean up memory cache if too large
      if (this.cache.size > this.cacheStats.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
        this.cacheStats.size = this.cache.size;
      }

      // Update Vercel KV cache
      await kv.set(key, entry, { ex: Math.floor(ttl / 1000) });
    } catch (error) {
      console.warn(`Cache write error for key ${key}:`, error);
    }
  }

  /**
   * Update cache statistics
   */
  private updateCacheStats(): void {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    this.cacheStats.hitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return { ...this.cacheStats };
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    // Clear memory cache
    this.cache.clear();
    this.cacheStats.size = 0;

    // Note: We don't clear Vercel KV here as it affects other instances
    // Individual cache entries will expire based on their TTL
  }

  /**
   * Update analytics configuration
   */
  updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }
}

/**
 * Default analytics client instance
 */
export const analyticsClient = new AnalyticsClient();

/**
 * Create a new analytics client with custom configuration
 */
export function createAnalyticsClient(config: Partial<AnalyticsConfig>): AnalyticsClient {
  return new AnalyticsClient(config);
}