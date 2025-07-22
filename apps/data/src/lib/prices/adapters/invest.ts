/**
 * INVEST adapter - Uses INVEST API prices
 */

import type { IOracleAdapter } from '../types';
import { getHostUrl } from '@modules/discovery';

interface InvestPriceData {
  tokenId: string;
  symbol: string;
  name: string;
  decimals: number;
  usdPrice: number;
  sbtcRatio: number;
  confidence: number;
  lastUpdated: number;
}

export class InvestAdapter implements IOracleAdapter {
  readonly name = 'invest';
  
  private priceCache = new Map<string, InvestPriceData>();
  private cacheExpiration = 0;
  private readonly CACHE_TTL = 60_000; // 1 minute cache
  
  async getBtcPriceUsd(): Promise<number> {
    await this.ensurePricesLoaded();
    
    const sBtcData = this.priceCache.get('SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token');
    
    if (!sBtcData) {
      throw new Error('[InvestAdapter] No sBTC price data available for BTC price calculation');
    }
    
    return sBtcData.usdPrice;
  }
  
  async getTokenPriceUsd(tokenId: string): Promise<number | null> {
    await this.ensurePricesLoaded();
    
    const priceData = this.priceCache.get(tokenId);
    
    if (!priceData) {
      return null;
    }
    
    // Check confidence level - require at least 80%
    if (priceData.confidence < 0.8) {
      console.warn(`[InvestAdapter] Price confidence too low for ${tokenId}: ${priceData.confidence}`);
      return null;
    }
    
    return priceData.usdPrice;
  }
  
  /**
   * Ensure price data is loaded and fresh
   */
  private async ensurePricesLoaded(): Promise<void> {
    const now = Date.now();
    
    // If cache is fresh, return
    if (this.priceCache.size > 0 && now < this.cacheExpiration) {
      return;
    }
    
    await this.fetchPricesFromApi();
  }
  
  private async fetchPricesFromApi(): Promise<void> {
    try {
      console.log('[InvestAdapter] Fetching price data from INVEST API...');
      
      const investUrl = getHostUrl('invest');
      const response = await fetch(`${investUrl}/api/v1/prices`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`INVEST API responded with status ${response.status}: ${response.statusText}. Response: ${errorText}`);
      }
      
      const responseText = await response.text();
      let apiData;
      
      try {
        apiData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[InvestAdapter] Failed to parse API response:', responseText.substring(0, 500));
        throw new Error(`INVEST API returned invalid JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }
      
      if (!apiData.data || !Array.isArray(apiData.data)) {
        throw new Error('INVEST API returned invalid data format - expected {data: array}');
      }
      
      // Update cache
      this.priceCache.clear();
      let validPrices = 0;
      
      for (const item of apiData.data) {
        if (item.tokenId && item.usdPrice !== undefined && item.confidence !== undefined) {
          this.priceCache.set(item.tokenId, {
            tokenId: item.tokenId,
            symbol: item.symbol || 'UNKNOWN',
            name: item.name || 'Unknown Token',
            decimals: Number(item.decimals) || 6,
            usdPrice: Number(item.usdPrice),
            sbtcRatio: Number(item.sbtcRatio) || 0,
            confidence: Number(item.confidence),
            lastUpdated: Number(item.lastUpdated) || Date.now()
          });
          validPrices++;
        }
      }
      
      this.cacheExpiration = Date.now() + this.CACHE_TTL;
      
      console.log(`[InvestAdapter] Cached ${validPrices} token prices from INVEST API`);
      
    } catch (error) {
      console.error(`[InvestAdapter] Failed to fetch price data:`, error);
      throw error;
    }
  }
  
  /**
   * Get cached price data for debugging
   */
  getCachedPrices(): Map<string, InvestPriceData> {
    return new Map(this.priceCache);
  }
}