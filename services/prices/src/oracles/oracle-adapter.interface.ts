/**
 * Oracle Adapter Interface - Simplified interface for oracle adapters
 * 
 * Focuses on the core functionality needed by the Oracle Price Engine
 */

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