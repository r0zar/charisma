/**
 * STXTools Oracle Adapter - Uses STXTools API for token prices
 * 
 * Integrates with @packages/tokens to fetch prices from STXTools API
 */

import { listPricesSTXTools } from '@repo/tokens';
import type { IOracleAdapter } from './oracle-adapter.interface';

export class STXToolsOracleAdapter implements IOracleAdapter {
  readonly name = 'stxtools';
  
  private priceCache: Record<string, number> = {};
  private cacheExpiration = 0;
  private readonly CACHE_TTL = 60_000; // 1 minute cache
  
  constructor() {}

  async getBtcPriceUsd(): Promise<number> {
    await this.ensurePricesLoaded();
    
    // Look for sBTC token price as BTC proxy
    const sBtcPrice = this.priceCache['SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token'];
    
    if (sBtcPrice) {
      return sBtcPrice;
    }
    
    // Look for BTC token (some DEXes might list it differently)
    const btcPrice = this.priceCache['BTC'] || this.priceCache['bitcoin'];
    
    if (btcPrice) {
      return btcPrice;
    }
    
    throw new Error('[STXToolsOracleAdapter] No BTC price data available from STXTools');
  }

  async getTokenPriceUsd(tokenId: string): Promise<number | null> {
    await this.ensurePricesLoaded();
    
    // Handle STX variants
    if (tokenId === '.stx' || tokenId === 'stx') {
      return this.priceCache['.stx'] || this.priceCache['stx'] || null;
    }
    
    return this.priceCache[tokenId] || null;
  }

  /**
   * Ensure price data is loaded and fresh
   */
  private async ensurePricesLoaded(): Promise<void> {
    const now = Date.now();
    
    // If cache is fresh, return
    if (Object.keys(this.priceCache).length > 0 && now < this.cacheExpiration) {
      return;
    }
    
    await this.fetchPricesFromSTXTools();
  }

  private async fetchPricesFromSTXTools(): Promise<void> {
    try {
      console.log('[STXToolsOracleAdapter] Fetching price data from STXTools API...');
      
      const prices = await listPricesSTXTools();
      
      // Update cache
      this.priceCache = prices;
      this.cacheExpiration = Date.now() + this.CACHE_TTL;
      
      const tokenCount = Object.keys(prices).length;
      console.log(`[STXToolsOracleAdapter] Cached ${tokenCount} token prices from STXTools API`);
      
      if (tokenCount === 0) {
        console.warn('[STXToolsOracleAdapter] No prices returned from STXTools API');
      }
      
    } catch (error) {
      console.error(`[STXToolsOracleAdapter] Failed to fetch price data:`, error);
      throw error;
    }
  }

  /**
   * Get cached price data for debugging
   */
  getCachedPrices(): Record<string, number> {
    return { ...this.priceCache };
  }
  
  /**
   * Clear the price cache
   */
  clearCache(): void {
    this.priceCache = {};
    this.cacheExpiration = 0;
  }
}