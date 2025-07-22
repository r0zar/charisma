/**
 * Simple Price Service - Clean, fast, no memory leaks
 */

import { unifiedBlobStorage } from '../storage/unified-blob-storage';

interface TokenPrice {
  usdPrice: number;
  source: string;
  timestamp: number;
}

interface PriceResponse {
  [tokenId: string]: TokenPrice;
}

interface StoredPriceData {
  timestamp: number;
  prices: PriceResponse;
  tokenCount: number;
  source: string;
}

/**
 * Simple price service that checks blob storage first, then external APIs
 */
class SimplePriceService {
  private readonly TIMEOUT_MS = 2000; // 2 second max
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Get price for a single token
   */
  async getPrice(tokenId: string): Promise<TokenPrice | null> {
    try {
      // Handle sBTC as 1:1 with BTC
      if (tokenId.includes('sbtc-token')) {
        const btcPrice = await this.getBtcPrice();
        if (btcPrice) {
          return {
            usdPrice: btcPrice,
            source: 'coingecko-btc',
            timestamp: Date.now()
          };
        }
      }
      
      // Try to get token price from STX Tools (common for Stacks tokens)
      const stxPrice = await this.getStxTokenPrice(tokenId);
      if (stxPrice) {
        return stxPrice;
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to get price for ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get BTC price from CoinGecko
   */
  private async getBtcPrice(): Promise<number | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
      
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.bitcoin?.usd || null;
    } catch (error) {
      console.warn('Failed to get BTC price from CoinGecko:', error);
      return null;
    }
  }

  /**
   * Get token price from STX Tools (for Stacks ecosystem tokens)
   */
  private async getStxTokenPrice(tokenId: string): Promise<TokenPrice | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
      
      // STX Tools API endpoint for token prices
      const response = await fetch(`https://api.stxtools.io/token/${tokenId}/price`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.usd_price && typeof data.usd_price === 'number') {
        return {
          usdPrice: data.usd_price,
          source: 'stxtools',
          timestamp: Date.now()
        };
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to get STX token price for ${tokenId}:`, error);
      return null;
    }
  }
  
  /**
   * Get prices for multiple tokens
   */
  async getPrices(tokenIds: string[]): Promise<PriceResponse> {
    const prices: PriceResponse = {};
    
    // Process tokens with timeout protection
    const promises = tokenIds.map(async (tokenId) => {
      try {
        const price = await this.getPrice(tokenId);
        if (price) {
          prices[tokenId] = price;
        }
      } catch (error) {
        console.warn(`Failed to get price for ${tokenId}:`, error);
      }
    });
    
    // Wait for all promises with overall timeout
    await Promise.race([
      Promise.allSettled(promises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), this.TIMEOUT_MS)
      )
    ]).catch(() => {
      // Timeout reached, return what we have
      console.warn('Price fetching timed out, returning partial results');
    });
    
    return prices;
  }
  
  /**
   * Get stored prices from blob storage
   */
  async getStoredPrices(): Promise<PriceResponse | null> {
    try {
      // Get from the prices blob, looking at the current section
      const pricesBlob = await unifiedBlobStorage.get('prices');
      
      if (!pricesBlob || typeof pricesBlob !== 'object') {
        return null;
      }
      
      const currentData = (pricesBlob as any).current as StoredPriceData;
      if (!currentData || !currentData.prices) {
        return null;
      }
      
      // Check if data is still fresh
      const age = Date.now() - currentData.timestamp;
      if (age < this.CACHE_TTL) {
        console.log(`[SimplePriceService] Using stored prices (age: ${Math.round(age / 1000)}s)`);
        return currentData.prices;
      } else {
        console.log(`[SimplePriceService] Stored prices expired (age: ${Math.round(age / 1000)}s)`);
        return null;
      }
    } catch (error) {
      console.warn('[SimplePriceService] Failed to get stored prices:', error);
      return null;
    }
  }

  /**
   * Get current prices - checks blob storage first, then fetches fresh
   */
  async getCurrentPrices(forceRefresh: boolean = false): Promise<PriceResponse> {
    // First try stored prices unless forced refresh
    if (!forceRefresh) {
      const stored = await this.getStoredPrices();
      if (stored && Object.keys(stored).length > 0) {
        return stored;
      }
    }
    
    // Fallback to fetching fresh prices
    console.log('[SimplePriceService] Fetching fresh prices from external APIs');
    const knownTokens = [
      'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
    ];
    
    return this.getPrices(knownTokens);
  }
}

// Export singleton
export const simplePriceService = new SimplePriceService();