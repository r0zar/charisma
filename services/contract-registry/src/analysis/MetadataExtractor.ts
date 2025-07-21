/**
 * MetadataExtractor - Extracts token metadata for both SIP010 (FTs) and SIP009 (NFTs)
 * 
 * FTs use simple read-only calls: get-name(), get-symbol(), get-decimals(), etc.
 * NFTs use token-specific calls: get-token-uri(token-id), get-owner(token-id), etc.
 */

import { callReadOnly } from '@repo/polyglot';
import { uintCV } from '@stacks/transactions';
import type { TokenCacheData } from '@repo/tokens';

export interface TokenMetadata {
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: string;
  tokenUri?: string;
  description?: string;
  image?: string;
  // NFT-specific
  lastTokenId?: number;
  collectionInfo?: {
    name?: string;
    description?: string;
    image?: string;
  };
}

export class MetadataExtractor {
  
  /**
   * Extract metadata based on contract type (SIP010 vs SIP009)
   */
  async extractMetadata(contractId: string, contractType: 'token' | 'nft' | 'vault' | 'unknown', implementedTraits: string[]): Promise<TokenMetadata | null> {
    try {
      if (implementedTraits.includes('SIP010') || contractType === 'token') {
        return await this.extractFungibleTokenMetadata(contractId);
      } else if (implementedTraits.includes('SIP009') || contractType === 'nft') {
        return await this.extractNFTMetadata(contractId);
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to extract metadata for ${contractId}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Extract SIP010 (Fungible Token) metadata
   * Uses standard SIP010 functions: get-name(), get-symbol(), get-decimals(), etc.
   */
  private async extractFungibleTokenMetadata(contractId: string): Promise<TokenMetadata> {
    const metadata: TokenMetadata = {};

    try {
      // Get basic token info - these don't require parameters
      const [nameResult, symbolResult, decimalsResult, totalSupplyResult] = await Promise.allSettled([
        this.safeCallReadOnly(contractId, 'get-name', []),
        this.safeCallReadOnly(contractId, 'get-symbol', []),
        this.safeCallReadOnly(contractId, 'get-decimals', []),
        this.safeCallReadOnly(contractId, 'get-total-supply', [])
      ]);

      // Process results
      if (nameResult.status === 'fulfilled' && nameResult.value) {
        metadata.name = this.extractStringFromResponse(nameResult.value);
      }

      if (symbolResult.status === 'fulfilled' && symbolResult.value) {
        metadata.symbol = this.extractStringFromResponse(symbolResult.value);
      }

      if (decimalsResult.status === 'fulfilled' && decimalsResult.value) {
        metadata.decimals = this.extractNumberFromResponse(decimalsResult.value);
      }

      if (totalSupplyResult.status === 'fulfilled' && totalSupplyResult.value) {
        metadata.totalSupply = this.extractNumberFromResponse(totalSupplyResult.value)?.toString();
      }

      // Try to get token URI if available (some SIP010 tokens have it)
      try {
        const tokenUriResult = await this.safeCallReadOnly(contractId, 'get-token-uri', []);
        if (tokenUriResult) {
          metadata.tokenUri = this.extractStringFromResponse(tokenUriResult);
        }
      } catch {
        // Token URI is optional for SIP010
      }

    } catch (error) {
      console.warn(`Error extracting FT metadata for ${contractId}:`, error);
    }

    return metadata;
  }

  /**
   * Extract SIP009 (NFT) metadata
   * Uses NFT-specific functions that require token-id parameter
   */
  private async extractNFTMetadata(contractId: string): Promise<TokenMetadata> {
    const metadata: TokenMetadata = {};

    try {
      // First, get the last token ID to know the collection size
      const lastTokenIdResult = await this.safeCallReadOnly(contractId, 'get-last-token-id', []);
      if (lastTokenIdResult) {
        metadata.lastTokenId = this.extractNumberFromResponse(lastTokenIdResult);
      }

      // For NFT collections, we'll try to get metadata from token ID 1 (most common)
      // and also try token ID 0 in case the collection starts from 0
      const tokenIds = [uintCV(1), uintCV(0)];
      
      for (const tokenId of tokenIds) {
        try {
          const tokenUriResult = await this.safeCallReadOnly(contractId, 'get-token-uri', [tokenId]);
          if (tokenUriResult) {
            const uri = this.extractStringFromResponse(tokenUriResult);
            if (uri) {
              metadata.tokenUri = uri;
              
              // Try to fetch collection info from the URI
              const collectionInfo = await this.fetchCollectionInfoFromUri(uri);
              if (collectionInfo) {
                metadata.collectionInfo = collectionInfo;
                // Use collection info as fallback for main metadata
                if (!metadata.name && collectionInfo.name) {
                  metadata.name = collectionInfo.name;
                }
                if (!metadata.description && collectionInfo.description) {
                  metadata.description = collectionInfo.description;
                }
                if (!metadata.image && collectionInfo.image) {
                  metadata.image = collectionInfo.image;
                }
              }
              break; // Found a working token ID, stop trying
            }
          }
        } catch {
          // Try next token ID
          continue;
        }
      }

      // Try to get owner of token 1 to validate it's a real NFT
      try {
        await this.safeCallReadOnly(contractId, 'get-owner', [uintCV(1)]);
        // If this doesn't throw, it's likely a valid NFT
      } catch {
        // Not a problem, just means token 1 might not exist or function isn't implemented
      }

    } catch (error) {
      console.warn(`Error extracting NFT metadata for ${contractId}:`, error);
    }

    return metadata;
  }

  /**
   * Safe wrapper for callReadOnly that handles errors gracefully
   */
  private async safeCallReadOnly(contractId: string, functionName: string, args: any[]): Promise<any> {
    try {
      const result = await callReadOnly(contractId, functionName, args);
      return result;
    } catch (error) {
      console.debug(`Failed to call ${functionName} on ${contractId}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Extract string value from Clarity response
   * Handles both direct strings and response types with ok/error
   */
  private extractStringFromResponse(response: any): string | undefined {
    if (!response) return undefined;

    // Handle direct string values
    if (typeof response === 'string') {
      return response;
    }

    // Handle response types (ok/error pattern)
    if (response.value) {
      // Extract from successful response
      if (typeof response.value === 'string') {
        return response.value;
      }
      
      // Handle string-ascii or string-utf8 types
      if (response.value['string-ascii']) {
        return response.value['string-ascii'];
      }
      
      if (response.value['string-utf8']) {
        return response.value['string-utf8'];
      }

      // Handle optional string values
      if (response.value.optional && response.value.optional !== null) {
        if (typeof response.value.optional === 'string') {
          return response.value.optional;
        }
        if (response.value.optional['string-ascii']) {
          return response.value.optional['string-ascii'];
        }
        if (response.value.optional['string-utf8']) {
          return response.value.optional['string-utf8'];
        }
      }
    }

    return undefined;
  }

  /**
   * Extract number value from Clarity response
   */
  private extractNumberFromResponse(response: any): number | undefined {
    if (!response) return undefined;

    // Handle direct number values
    if (typeof response === 'number') {
      return response;
    }

    // Handle bigint values (common for uint types)
    if (typeof response === 'bigint') {
      return Number(response);
    }

    // Handle response types
    if (response.value !== undefined) {
      if (typeof response.value === 'number') {
        return response.value;
      }
      if (typeof response.value === 'bigint') {
        return Number(response.value);
      }
    }

    return undefined;
  }

  /**
   * Try to fetch collection info from NFT metadata URI
   */
  private async fetchCollectionInfoFromUri(uri: string): Promise<TokenMetadata['collectionInfo'] | null> {
    try {
      // Skip data URIs and invalid URIs
      if (!uri.startsWith('http')) {
        return null;
      }

      const response = await fetch(uri, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        return null;
      }

      const metadata = await response.json();
      
      return {
        name: metadata.name || metadata.collection_name,
        description: metadata.description || metadata.collection_description,
        image: metadata.image || metadata.collection_image
      };
    } catch (error) {
      console.debug(`Failed to fetch collection info from URI ${uri}:`, error);
      return null;
    }
  }

  /**
   * Convert extracted metadata to TokenCacheData format
   */
  convertToTokenCacheData(contractId: string, metadata: TokenMetadata, contractType: 'token' | 'nft' | 'vault' | 'unknown'): TokenCacheData {
    return {
      contractId,
      type: contractType,
      name: metadata.name || '',
      symbol: metadata.symbol || '',
      description: metadata.description || metadata.collectionInfo?.description || null,
      image: metadata.image || metadata.collectionInfo?.image || null,
      decimals: metadata.decimals || (contractType === 'nft' ? 0 : 6), // NFTs typically have 0 decimals
      token_uri: metadata.tokenUri || null,
      total_supply: metadata.totalSupply || null,
      identifier: metadata.symbol || contractId.split('.')[1] || contractId,
      lastUpdated: Date.now(),
      // Optional fields
      tokenAContract: null,
      tokenBContract: null,
      lpRebatePercent: null,
      externalPoolId: null,
      engineContractId: null,
      base: null,
      usdPrice: null,
      confidence: null,
      marketPrice: null,
      intrinsicValue: null,
      totalLiquidity: null
    };
  }
}