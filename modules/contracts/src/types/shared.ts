/**
 * Shared type definitions for contract operations
 */

/**
 * Transaction result from contract operations
 */
export interface TransactionResult {
  success: boolean;
  txid?: string;
  error?: string;
}

/**
 * Contract metadata for type detection
 */
export interface ContractMetadata {
  type: 'TOKEN' | 'SUBNET' | 'SUBLINK' | 'POOL' | 'UNKNOWN';
  base?: string; // For subnet tokens
  [key: string]: any;
}

/**
 * Cached token metadata (from @repo/tokens)
 */
export interface TokenCacheData {
  contractId: string;
  type?: string;
  base?: string | null;
  symbol: string;
  name: string;
  decimals?: number;
  image?: string | null;
  [key: string]: any;
}