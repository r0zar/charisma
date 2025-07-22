/**
 * Token Metadata Utilities
 * 
 * Integrates with @repo/tokens to provide token metadata
 * for proper decimal formatting and display.
 */

import { getTokenMetadataCached, type TokenCacheData } from '@repo/tokens';
import { convertAtomicToDecimal, convertDecimalToAtomic } from './decimal-utils';

export interface TokenDisplayInfo {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  image?: string;
  description?: string;
}

export interface FormattedAmount {
  value: string;
  decimals: number;
  symbol: string;
  raw: bigint;
}

export class TokenMetadataService {
  private cache = new Map<string, TokenDisplayInfo | null>();

  /**
   * Get token metadata from @repo/tokens - NO FALLBACKS
   */
  async getTokenMetadata(contractId: string): Promise<TokenDisplayInfo | null> {
    // Check cache first
    if (this.cache.has(contractId)) {
      return this.cache.get(contractId);
    }

    try {
      const tokenData = await getTokenMetadataCached(contractId);
      
      // Only return data if we have REAL token metadata with required fields
      if (!this.hasValidTokenMetadata(tokenData)) {
        console.log(`[TokenMetadataService] No valid token metadata for ${contractId}`);
        this.cache.set(contractId, null);
        return null;
      }

      const metadata = this.tokenCacheDataToDisplayInfo(tokenData);
      this.cache.set(contractId, metadata);
      return metadata;

    } catch (error) {
      console.warn(`[TokenMetadataService] Failed to get metadata for ${contractId}:`, error);
      this.cache.set(contractId, null);
      return null;
    }
  }

  /**
   * Check if token metadata has the minimum required fields
   */
  private hasValidTokenMetadata(tokenData: TokenCacheData | null): boolean {
    return tokenData !== null && 
           tokenData.name && 
           tokenData.symbol && 
           tokenData.decimals !== undefined;
  }

  /**
   * Format an atomic amount using token metadata - returns null if no metadata
   */
  async formatAmount(contractId: string, atomicAmount: bigint): Promise<FormattedAmount | null> {
    const metadata = await this.getTokenMetadata(contractId);
    
    if (!metadata) {
      return null;
    }

    const decimalValue = convertAtomicToDecimal(Number(atomicAmount), metadata.decimals);

    return {
      value: this.formatDecimalValue(decimalValue, metadata.decimals),
      decimals: metadata.decimals,
      symbol: metadata.symbol,
      raw: atomicAmount
    };
  }

  /**
   * Parse a decimal amount to atomic units using token metadata - returns null if no metadata
   */
  async parseAmount(contractId: string, decimalAmount: number): Promise<bigint | null> {
    const metadata = await this.getTokenMetadata(contractId);
    
    if (!metadata) {
      return null;
    }

    const atomicValue = convertDecimalToAtomic(decimalAmount, metadata.decimals);
    return BigInt(atomicValue);
  }

  /**
   * Get display information for multiple tokens
   */
  async getMultipleTokenMetadata(contractIds: string[]): Promise<Map<string, TokenDisplayInfo>> {
    const results = new Map<string, TokenDisplayInfo>();

    // Process tokens in parallel
    await Promise.allSettled(
      contractIds.map(async (contractId) => {
        const metadata = await this.getTokenMetadata(contractId);
        if (metadata) {
          results.set(contractId, metadata);
        }
      })
    );

    return results;
  }

  /**
   * Clear the metadata cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Convert TokenCacheData to display info
   */
  private tokenCacheDataToDisplayInfo(tokenData: TokenCacheData): TokenDisplayInfo {
    return {
      contractId: tokenData.contractId,
      name: tokenData.name,
      symbol: tokenData.symbol,
      decimals: tokenData.decimals!,
      image: tokenData.image || undefined,
      description: tokenData.description || undefined
    };
  }


  /**
   * Format decimal value for display
   */
  private formatDecimalValue(value: number, decimals: number): string {
    // For very small values, show more precision
    if (value < 0.001) {
      return value.toFixed(Math.min(decimals, 8));
    }
    
    // For moderate values, show reasonable precision
    if (value < 1) {
      return value.toFixed(6);
    }
    
    // For larger values, show fewer decimals
    if (value < 1000) {
      return value.toFixed(4);
    }
    
    // For very large values, show minimal decimals
    return value.toFixed(2);
  }
}

// Singleton instance for easy use
export const tokenMetadataService = new TokenMetadataService();

/**
 * Utility function to format amounts with proper decimals - returns null if no metadata
 */
export async function formatTokenAmount(
  contractId: string, 
  atomicAmount: bigint
): Promise<string | null> {
  const formatted = await tokenMetadataService.formatAmount(contractId, atomicAmount);
  return formatted ? `${formatted.value} ${formatted.symbol}` : null;
}

/**
 * Utility function to format amounts with symbol - returns null if no metadata
 */
export async function formatTokenAmountWithSymbol(
  contractId: string,
  atomicAmount: bigint,
  includeSymbol: boolean = true
): Promise<FormattedAmount | null> {
  return await tokenMetadataService.formatAmount(contractId, atomicAmount);
}