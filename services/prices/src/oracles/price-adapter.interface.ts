/**
 * Uniform interface for external price feed adapters
 */

export interface PriceData {
  symbol: string;
  usdPrice: number;
  source: string;
  timestamp: number;
  reliability: 'high' | 'medium' | 'low';
}

export interface PriceAdapterResult {
  success: boolean;
  data?: PriceData;
  error?: string;
}

export interface PriceAdapterConfig {
  timeoutMs: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface IPriceAdapter {
  readonly name: string;
  
  /**
   * Check if this adapter supports the given symbol
   */
  supportsSymbol(symbol: string): boolean;
  
  /**
   * Fetch price data for a symbol
   */
  fetchPrice(symbol: string): Promise<PriceAdapterResult>;
  
  /**
   * Get supported symbols
   */
  getSupportedSymbols(): string[];
}