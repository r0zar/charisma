/**
 * Kraken API adapter for price feeds
 */

import type { IPriceAdapter, PriceAdapterResult, PriceAdapterConfig, PriceData } from './price-adapter.interface';

export class KrakenAdapter implements IPriceAdapter {
  readonly name = 'kraken';
  
  private readonly supportedSymbols = new Set(['BTC']);
  private readonly symbolToKrakenPair: Record<string, string> = {
    'BTC': 'XXBTZUSD'
  };

  constructor(private config: PriceAdapterConfig) {}

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
        error: `Symbol ${symbol} not supported by Kraken adapter`
      };
    }

    const pair = this.symbolToKrakenPair[symbol];
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Charisma-Prices/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `Kraken API HTTP error: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();

      if (data.error && data.error.length > 0) {
        return {
          success: false,
          error: `Kraken API error: ${data.error.join(', ')}`
        };
      }

      const tickerData = data.result?.[pair];
      if (!tickerData?.c?.[0]) {
        return {
          success: false,
          error: `No price data from Kraken for ${symbol}`
        };
      }

      const price = parseFloat(tickerData.c[0]);
      if (isNaN(price) || price <= 0) {
        return {
          success: false,
          error: `Invalid price from Kraken: ${tickerData.c[0]}`
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
          error: `Kraken API timeout after ${this.config.timeoutMs}ms`
        };
      }
      
      return {
        success: false,
        error: `Kraken API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}