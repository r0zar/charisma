/**
 * Shared interfaces used across blaze-sdk and other packages
 * These interfaces consolidate token metadata, balance data, and price information
 */

/**
 * Comprehensive token metadata interface combining all sources:
 * - TokenCacheData from @packages/tokens
 * - PriceStats from simple-swap price metrics  
 * - Additional LP token and market data
 */
export interface TokenMetadata {
  // Core token information
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  type: string;
  identifier: string;
  
  // Optional metadata
  description?: string | null;
  image?: string | null;
  token_uri?: string | null;
  total_supply?: string | null;
  lastUpdated?: number | null;
  
  // LP Token specific fields
  tokenAContract?: string | null;
  tokenBContract?: string | null;
  lpRebatePercent?: number | null;
  externalPoolId?: string | null;
  engineContractId?: string | null;
  base?: string | null;
  
  // Price and market data (from token-summaries API)
  price?: number | null;
  change1h?: number | null;
  change24h?: number | null;
  change7d?: number | null;
  marketCap?: number | null;
  
  // Verification status
  verified?: boolean;
}

/**
 * Enhanced balance data interface that includes complete token metadata
 */
export interface EnhancedBalanceData {
  // Core balance information
  balance: string;
  totalSent: string;
  totalReceived: string;
  formattedBalance: number;
  timestamp: number;
  source: string;
  
  // Subnet balance fields
  subnetBalance?: number;
  formattedSubnetBalance?: number;
  subnetContractId?: string;
  
  // Complete token metadata embedded
  metadata: TokenMetadata;
}

/**
 * Price data interface for real-time price updates
 */
export interface PriceData {
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
  
  // Optional historical change data
  change1h?: number | null;
  change24h?: number | null;
  change7d?: number | null;
}

/**
 * Token summary type that combines metadata with price statistics
 * This matches the TokenSummary type from simple-swap
 */
export interface TokenSummary extends TokenMetadata {
  // Price statistics
  price: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCap: number | null;
}