/**
 * Oracle Price Service - Integrates the oracle price engine into the data app
 */

import { 
  OraclePriceEngine, 
  type IOraclePriceEngine, 
  type OraclePriceResult, 
  defaultOracleConfig,
  CoinGeckoOracleAdapter,
  KrakenOracleAdapter,
  STXToolsOracleAdapter
} from '@services/prices';
import { blobStorageService } from './blob-storage-service';

export interface PriceServiceResult {
  usdPrice: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
  lastUpdated: number;
  source: string;
  confidence: number;
  isLpToken?: boolean;
  intrinsicValue?: number;
  marketPrice?: number;
  priceDeviation?: number;
  isArbitrageOpportunity?: boolean;
  pathsUsed?: number;
  totalLiquidity?: number;
  priceSource?: 'market' | 'intrinsic' | 'hybrid';
}

/**
 * Oracle Price Service - Provides cached and real-time price data
 */
class OraclePriceService {
  private engine: IOraclePriceEngine;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly PRICE_CACHE_KEY = 'oracle-prices';
  private priceCache: Map<string, { data: PriceServiceResult; timestamp: number }> = new Map();

  constructor() {
    // Initialize the oracle engine
    this.engine = new OraclePriceEngine(defaultOracleConfig);

    // Register oracle adapters
    this.registerAdapters();
    
    console.log('✅ OraclePriceService initialized with oracle adapters');
  }

  /**
   * Register available oracle adapters
   */
  private registerAdapters(): void {
    try {
      // Coingecko adapter
      const coingeckoAdapter = new CoinGeckoOracleAdapter();
      this.engine.registerAdapter(coingeckoAdapter);

      // Kraken adapter  
      const krakenAdapter = new KrakenOracleAdapter();
      this.engine.registerAdapter(krakenAdapter);

      // STXTools adapter
      const stxToolsAdapter = new STXToolsOracleAdapter();
      this.engine.registerAdapter(stxToolsAdapter);

      console.log(`[OraclePriceService] Registered ${this.engine.getAdapters().length} oracle adapters`);
    } catch (error) {
      console.warn('[OraclePriceService] Error registering adapters:', error);
    }
  }

  /**
   * Get price for a single token
   */
  async getTokenPrice(tokenId: string): Promise<PriceServiceResult | null> {
    try {
      // Check cache first
      const cached = this.priceCache.get(tokenId);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        console.log(`[OraclePriceService] Returning cached price for ${tokenId}`);
        return cached.data;
      }

      console.log(`[OraclePriceService] Fetching fresh price for ${tokenId}`);
      
      // Get price from oracle engine
      const oracleResult = await this.engine.getPrice(tokenId);
      
      if (!oracleResult) {
        return null;
      }

      // Convert to PriceServiceResult format
      const result = this.convertOracleResultToPriceResult(oracleResult);
      
      // Cache the result
      this.priceCache.set(tokenId, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error(`[OraclePriceService] Error getting price for ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get prices for multiple tokens
   */
  async getMultiplePrices(tokenIds: string[]): Promise<Record<string, PriceServiceResult>> {
    try {
      console.log(`[OraclePriceService] Getting prices for ${tokenIds.length} tokens`);

      // Check cache for all tokens first
      const results: Record<string, PriceServiceResult> = {};
      const tokensToFetch: string[] = [];
      
      for (const tokenId of tokenIds) {
        const cached = this.priceCache.get(tokenId);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
          results[tokenId] = cached.data;
        } else {
          tokensToFetch.push(tokenId);
        }
      }

      if (tokensToFetch.length > 0) {
        console.log(`[OraclePriceService] Fetching fresh prices for ${tokensToFetch.length} tokens`);
        
        // Get fresh prices from oracle engine
        const oracleResults = await this.engine.getMultiplePrices(tokensToFetch);
        
        // Convert and cache results
        for (const [tokenId, oracleResult] of oracleResults) {
          const result = this.convertOracleResultToPriceResult(oracleResult);
          results[tokenId] = result;
          
          // Cache the result
          this.priceCache.set(tokenId, {
            data: result,
            timestamp: Date.now()
          });
        }
      }

      console.log(`[OraclePriceService] Returning prices for ${Object.keys(results).length} tokens`);
      return results;
      
    } catch (error) {
      console.error('[OraclePriceService] Error getting multiple prices:', error);
      return {};
    }
  }

  /**
   * Get all available prices
   */
  async getAllPrices(): Promise<Record<string, PriceServiceResult>> {
    try {
      // Try to get stored prices from blob first
      const storedPrices = await this.getStoredPrices();
      
      if (Object.keys(storedPrices).length > 0) {
        console.log(`[OraclePriceService] Returning ${Object.keys(storedPrices).length} stored prices`);
        return storedPrices;
      }

      // If no stored prices, return cached prices
      const cachedPrices: Record<string, PriceServiceResult> = {};
      for (const [tokenId, cached] of this.priceCache) {
        if ((Date.now() - cached.timestamp) < this.CACHE_TTL) {
          cachedPrices[tokenId] = cached.data;
        }
      }

      console.log(`[OraclePriceService] Returning ${Object.keys(cachedPrices).length} cached prices`);
      return cachedPrices;
      
    } catch (error) {
      console.error('[OraclePriceService] Error getting all prices:', error);
      return {};
    }
  }

  /**
   * Get stored prices from blob storage
   */
  private async getStoredPrices(): Promise<Record<string, PriceServiceResult>> {
    try {
      const storedData = await blobStorageService.get(this.PRICE_CACHE_KEY);
      
      if (storedData && typeof storedData === 'object') {
        return storedData as Record<string, PriceServiceResult>;
      }
      
      return {};
    } catch (error) {
      console.warn('[OraclePriceService] Error getting stored prices:', error);
      return {};
    }
  }

  /**
   * Save prices to blob storage
   */
  async savePricesToBlob(prices: Record<string, PriceServiceResult>): Promise<void> {
    try {
      await blobStorageService.put(this.PRICE_CACHE_KEY, prices);
      console.log(`[OraclePriceService] Saved ${Object.keys(prices).length} prices to blob storage`);
    } catch (error) {
      console.warn('[OraclePriceService] Error saving prices to blob:', error);
    }
  }

  /**
   * Refresh all prices and save to blob
   */
  async refreshAndSavePrices(tokenIds: string[]): Promise<void> {
    try {
      console.log(`[OraclePriceService] Refreshing prices for ${tokenIds.length} tokens`);
      
      // Clear cache to force fresh data
      this.priceCache.clear();
      
      // Get fresh prices
      const freshPrices = await this.getMultiplePrices(tokenIds);
      
      // Save to blob storage
      await this.savePricesToBlob(freshPrices);
      
      console.log(`[OraclePriceService] Refreshed and saved ${Object.keys(freshPrices).length} prices`);
    } catch (error) {
      console.error('[OraclePriceService] Error refreshing prices:', error);
    }
  }

  /**
   * Convert OraclePriceResult to PriceServiceResult
   */
  private convertOracleResultToPriceResult(oracleResult: OraclePriceResult): PriceServiceResult {
    const successfulAdapters = oracleResult.oracleResults.filter(r => r.success);
    const confidence = successfulAdapters.length / oracleResult.oracleResults.length;
    
    return {
      usdPrice: oracleResult.price.usdPrice,
      lastUpdated: oracleResult.metadata.timestamp,
      source: `oracle(${successfulAdapters.map(a => a.adapterName).join(',')})`,
      confidence,
      priceSource: 'market'
    };
  }

  /**
   * Get service statistics
   */
  getStats() {
    const engineStats = this.engine.getStats();
    
    return {
      ...engineStats,
      cacheSize: this.priceCache.size,
      cacheHitRatio: this.calculateCacheHitRatio()
    };
  }

  /**
   * Calculate cache hit ratio (simplified)
   */
  private calculateCacheHitRatio(): number {
    // This is a simplified calculation
    // In production, you'd want to track actual hits/misses
    return this.priceCache.size > 0 ? 0.8 : 0;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.priceCache.clear();
    console.log('[OraclePriceService] Cache cleared');
  }
}

// Export singleton instance
export const oraclePriceService = new OraclePriceService();