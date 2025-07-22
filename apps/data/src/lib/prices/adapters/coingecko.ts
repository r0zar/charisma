/**
 * CoinGecko adapter - merged adapter and oracle functionality
 */

import type { 
  IPriceAdapter, 
  IOracleAdapter, 
  PriceAdapterResult, 
  PriceAdapterConfig, 
  PriceData 
} from '../types';

export class CoinGeckoAdapter implements IPriceAdapter, IOracleAdapter {
  readonly name = 'coingecko';
  
  private readonly supportedSymbols = new Set(['BTC']);
  private readonly symbolToCoinGeckoId: Record<string, string> = {
    'BTC': 'bitcoin'
  };

  constructor(private config: PriceAdapterConfig = { timeoutMs: 5000 }) {}

  supportsSymbol(symbol: string): boolean {
    return this.supportedSymbols.has(symbol);
  }

  getSupportedSymbols(): string[] {
    return Array.from(this.supportedSymbols);
  }

  async fetchPrice(symbol: string): Promise<PriceAdapterResult> {
    if (!this.supportsSymbol(symbol)) {
      return {
        success: false,
        error: `Symbol ${symbol} not supported by CoinGecko adapter`
      };
    }

    const coinId = this.symbolToCoinGeckoId[symbol];
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Charisma-Prices/1.0'
          }
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `CoinGecko API HTTP error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      const price = data[coinId]?.usd;

      if (typeof price !== 'number' || price <= 0) {
        return {
          success: false,
          error: `No valid price data from CoinGecko for ${symbol}`
        };
      }

      const priceData: PriceData = {
        symbol,
        usdPrice: price,
        source: this.name,
        timestamp: Date.now(),
        reliability: 'high'
      };

      return {
        success: true,
        data: priceData
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: `CoinGecko API timeout after ${this.config.timeoutMs}ms`
        };
      }
      
      return {
        success: false,
        error: `CoinGecko API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getBtcPriceUsd(): Promise<number> {
    const result = await this.fetchPrice('BTC');
    
    if (!result.success || !result.data) {
      throw new Error(`CoinGecko BTC price failed: ${result.error}`);
    }
    
    return result.data.usdPrice;
  }

  async getTokenPriceUsd(tokenId: string): Promise<number | null> {
    // CoinGecko only supports BTC, and sBTC is handled specially
    if (tokenId === 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token') {
      // For sBTC, return BTC price since it's 1:1
      try {
        return await this.getBtcPriceUsd();
      } catch {
        return null;
      }
    }
    
    // No other tokens supported by CoinGecko adapter
    return null;
  }
}