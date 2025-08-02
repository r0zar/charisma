/**
 * Adapter layer to provide @repo/tokens compatibility using @services/contract-registry
 * This allows gradual migration without breaking existing code
 */

import { ContractRegistry, createDefaultConfig } from '@services/contract-registry';
import { getHostUrl } from '@modules/discovery';
import type { TokenCacheData, KraxelPriceData } from '@repo/tokens';

// Re-export types for centralized imports
export type { TokenCacheData, KraxelPriceData };

// Initialize contract registry
let contractRegistry: ContractRegistry | null = null;

function getContractRegistry(): ContractRegistry {
  if (!contractRegistry) {
    // Check if required environment variables are available
    if (!process.env.BLOB_BASE_URL || !process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error(`Contract Registry configuration missing. Required environment variables:
        - BLOB_BASE_URL: ${process.env.BLOB_BASE_URL ? '✓' : '✗'}
        - BLOB_READ_WRITE_TOKEN: ${process.env.BLOB_READ_WRITE_TOKEN ? '✓' : '✗'}
        
        Please configure these in your .env.local file to use contract-registry.`);
    }

    const config = createDefaultConfig('mainnet-contract-registry');
    contractRegistry = new ContractRegistry(config);
    console.log('[Contract Registry Adapter] Contract registry initialized successfully');
  }
  return contractRegistry;
}

/**
 * Adapter function that converts contract-registry metadata to TokenCacheData format
 */
function adaptTokenMetadata(contractId: string, registryData: any): TokenCacheData {
  const tokenMetadata = registryData?.tokenMetadata;

  if (!tokenMetadata) {
    // Return default structure for missing tokens
    return {
      type: 'token',
      contractId,
      name: 'Unknown Token',
      description: null,
      image: null,
      lastUpdated: null,
      decimals: 6,
      symbol: 'UNKNOWN',
      token_uri: null,
      identifier: contractId,
      total_supply: null,
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

  // Adapt contract-registry format to TokenCacheData format
  return {
    type: tokenMetadata.type || 'token',
    contractId: tokenMetadata.contractId,
    name: tokenMetadata.name || 'Unknown Token',
    description: tokenMetadata.description || null,
    image: tokenMetadata.image || null,
    lastUpdated: registryData.lastUpdated || Date.now(),
    decimals: tokenMetadata.decimals || 6,
    symbol: tokenMetadata.symbol || 'UNKNOWN',
    token_uri: tokenMetadata.token_uri || null,
    identifier: tokenMetadata.identifier || tokenMetadata.contractId,
    total_supply: tokenMetadata.total_supply || null,
    tokenAContract: tokenMetadata.tokenAContract || null,
    tokenBContract: tokenMetadata.tokenBContract || null,
    lpRebatePercent: tokenMetadata.lpRebatePercent || null,
    externalPoolId: tokenMetadata.externalPoolId || null,
    engineContractId: tokenMetadata.engineContractId || null,
    base: tokenMetadata.base || null,
    usdPrice: tokenMetadata.usdPrice || null,
    confidence: tokenMetadata.confidence || null,
    marketPrice: tokenMetadata.marketPrice || null,
    intrinsicValue: tokenMetadata.intrinsicValue || null,
    totalLiquidity: tokenMetadata.totalLiquidity || null
  };
}

/**
 * Replacement for listTokens() from @repo/tokens
 * Fetches all tokens from both contract-registry API and external token-cache API
 */
export async function listTokens(): Promise<TokenCacheData[]> {
  const contractRegistryUrl = getHostUrl('contract-registry');
  const response = await fetch(`${contractRegistryUrl}/api/tokens?type=all`);

  if (!response.ok) {
    throw new Error(`Failed to fetch tokens: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error(`Invalid tokens response: ${result.error}`);
  }

  const { tokens } = result.data;
  console.log(`[Contract Registry Adapter] Fetched ${tokens?.length || 0} tokens from cached API`);

  // Convert to TokenCacheData format
  let tokenData: TokenCacheData[] = tokens
    .filter((contract: any) => contract.tokenMetadata)
    .map((contract: any) => adaptTokenMetadata(contract.contractId, contract));

  // Also fetch from external token-cache API to get USDh and other external tokens
  try {
    const TOKEN_CACHE = process.env.NEXT_PUBLIC_TOKEN_CACHE_URL || process.env.TOKEN_CACHE_URL || 'https://tokens.charisma.rocks';
    const externalResponse = await fetch(`${TOKEN_CACHE}/api/v1/metadata`, {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (externalResponse.ok) {
      const externalTokens = await externalResponse.json();
      console.log(`[Contract Registry Adapter] Fetched ${externalTokens?.length || 0} tokens from external token-cache`);
      
      // Convert external tokens to TokenCacheData format and merge
      const externalTokenData: TokenCacheData[] = externalTokens
        .filter((token: any) => token.contractId && token.symbol)
        .map((token: any) => ({
          type: token.type || 'token',
          contractId: token.contractId,
          name: token.name || token.symbol,
          description: token.description || '',
          image: token.image || '',
          lastUpdated: token.lastUpdated || Date.now(),
          decimals: token.decimals || 6,
          symbol: token.symbol,
          token_uri: token.token_uri || null,
          identifier: token.identifier || token.symbol,
          total_supply: token.total_supply || null,
          tokenAContract: null,
          tokenBContract: null,
          lpRebatePercent: null,
          externalPoolId: null,
          engineContractId: null,
          base: token.base || null,
          usdPrice: token.usdPrice || null,
          confidence: token.confidence || null,
          marketPrice: token.marketPrice || null,
          intrinsicValue: token.intrinsicValue || null,
          totalLiquidity: token.totalLiquidity || null
        }));
      
      // Merge with existing tokens, preferring external data for duplicates
      const contractIdSet = new Set(tokenData.map(t => t.contractId));
      const newExternalTokens = externalTokenData.filter(t => !contractIdSet.has(t.contractId));
      
      tokenData = [...tokenData, ...newExternalTokens];
      console.log(`[Contract Registry Adapter] Total tokens after merge: ${tokenData.length}`);
    } else {
      console.warn(`[Contract Registry Adapter] Failed to fetch external tokens: ${externalResponse.status}`);
    }
  } catch (error) {
    console.warn('[Contract Registry Adapter] External token fetch failed:', error);
  }

  return tokenData;
}


/**
 * Replacement for getTokenMetadataCached() from @repo/tokens
 * Fetches individual token metadata from cached contract-registry API
 */
export async function getTokenMetadataCached(contractId: string): Promise<TokenCacheData> {
  const contractRegistryUrl = getHostUrl('contract-registry');
  const response = await fetch(`${contractRegistryUrl}/api/contracts/${encodeURIComponent(contractId)}`);

  if (!response.ok) {
    if (response.status === 404) {
      // Token not found in registry
      return adaptTokenMetadata(contractId, null);
    }
    throw new Error(`Failed to fetch contract ${contractId}: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error(`Invalid contract response for ${contractId}: ${result.error}`);
  }

  const contract = result.data;

  if (contract && contract.tokenMetadata) {
    return adaptTokenMetadata(contractId, contract);
  }

  // Return default structure for missing tokens
  return adaptTokenMetadata(contractId, null);
}


/**
 * Discovers and adds a missing token to the contract registry
 * This will fetch metadata from the blockchain and add it to our registry
 */
export async function discoverAndAddToken(contractId: string): Promise<TokenCacheData | null> {
  try {
    console.log(`[Contract Registry Adapter] Discovering token: ${contractId}`);

    const registry = getContractRegistry();

    // Try to add the contract (this will discover and analyze it automatically)
    const result = await registry.addContract(contractId);

    if (result.success && result.metadata) {
      console.log(`[Contract Registry Adapter] Successfully discovered token: ${contractId}`);

      // Convert to our format
      const tokenData = adaptTokenMetadata(contractId, result.metadata);

      return tokenData;
    } else {
      console.warn(`[Contract Registry Adapter] Failed to discover token ${contractId}:`, result.error);
      return null;
    }
  } catch (error) {
    console.error(`[Contract Registry Adapter] Error discovering token ${contractId}:`, error);
    return null;
  }
}

/**
 * Enhanced version of getTokenMetadataCached that includes discovery fallback
 * If token is not found, it will attempt to discover and add it to the registry
 */
export async function getTokenMetadataWithDiscovery(contractId: string): Promise<TokenCacheData> {
  // First try regular lookup
  let tokenData = await getTokenMetadataCached(contractId);

  // If we get an unknown token back, try discovery
  if (tokenData.symbol === 'UNKNOWN' || tokenData.name === 'Unknown Token') {
    console.log(`[Contract Registry Adapter] Token ${contractId} not found, attempting discovery...`);

    const discoveredToken = await discoverAndAddToken(contractId);
    if (discoveredToken) {
      tokenData = discoveredToken;
      console.log(`[Contract Registry Adapter] Successfully discovered and added token: ${contractId} (${discoveredToken.symbol})`);
    }
  }

  return tokenData;
}

/**
 * Batch fetch multiple tokens efficiently with strict rate limiting
 */
export async function getMultipleTokenMetadata(contractIds: string[]): Promise<Record<string, TokenCacheData>> {
  const results: Record<string, TokenCacheData> = {};

  // Use very conservative settings to avoid Vercel Blob rate limits
  const BATCH_SIZE = 2; // Reduced from 5 to 2
  const DELAY_MS = 200; // Increased delay between batches

  console.log(`[getMultipleTokenMetadata] Processing ${contractIds.length} tokens in batches of ${BATCH_SIZE}`);

  for (let i = 0; i < contractIds.length; i += BATCH_SIZE) {
    const batch = contractIds.slice(i, i + BATCH_SIZE);

    // Process batch with individual error handling and delays
    for (let j = 0; j < batch.length; j++) {
      const contractId = batch[j];
      try {
        // Add delay even within batch
        if (j > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const tokenData = await getTokenMetadataCached(contractId);
        results[contractId] = tokenData;
      } catch (error) {
        // Still add a default entry to avoid breaking downstream code
        results[contractId] = adaptTokenMetadata(contractId, null);
      }
    }

    // Add delay between batches to avoid hitting rate limits
    if (i + BATCH_SIZE < contractIds.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`[getMultipleTokenMetadata] Successfully processed ${Object.keys(results).length} tokens`);
  return results;
}

/**
 * Replacement for listPrices() from @repo/tokens
 * Uses the original working implementation from @repo/tokens
 */
export async function listPrices(): Promise<KraxelPriceData> {
  // Import and use the original working listPrices from @repo/tokens
  const { listPrices: originalListPrices } = await import('@repo/tokens');
  return originalListPrices();
}

