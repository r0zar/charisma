/**
 * Consolidated types and interfaces for the prices module
 */

// Basic price data structures
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

// Core adapter interfaces
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

export interface IOracleAdapter {
  readonly name: string;
  
  /**
   * Get BTC price in USD
   * Used as the base price for all conversions
   */
  getBtcPriceUsd(): Promise<number>;
  
  /**
   * Get token price in USD
   * Returns null if token is not supported or unavailable
   */
  getTokenPriceUsd(tokenId: string): Promise<number | null>;
}

// Service-level types
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

// Oracle engine types (extracted from oracle-price-engine.ts)
export interface OraclePriceConfig {
  maxConcurrentRequests: number;
  defaultTimeoutMs: number;
  retryAttempts: number;
  priceDeviationThreshold: number;
  minConfidenceLevel: number;
}

export interface OraclePriceResult {
  price: {
    usdPrice: number;
    btcPrice?: number;
    confidence: number;
  };
  oracleResults: Array<{
    adapterName: string;
    success: boolean;
    price?: number;
    error?: string;
    responseTime: number;
  }>;
  metadata: {
    timestamp: number;
    totalResponseTime: number;
    successfulAdapters: number;
    failedAdapters: number;
  };
}

// Historical service types
export interface HistoricalPriceData {
  timestamp: number;
  usdPrice: number;
  source: string;
  confidence: number;
}

export interface CollectionResult {
  success: boolean;
  collected: number;
  errors: Array<{
    tokenId: string;
    error: string;
  }>;
}

export interface HistoricalStats {
  totalDataPoints: number;
  oldestEntry: number;
  newestEntry: number;
  coverage: Record<string, number>;
}