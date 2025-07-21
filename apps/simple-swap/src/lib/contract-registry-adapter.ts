/**
 * Adapter layer to provide @repo/tokens compatibility using @services/contract-registry
 * This allows gradual migration without breaking existing code
 */

import { ContractRegistry, createDefaultConfig } from '@services/contract-registry';
import { PriceSeriesAPI, PriceSeriesStorage } from '@services/prices';
import type { TokenCacheData, KraxelPriceData } from '@repo/tokens';

// Re-export types for centralized imports
export type { TokenCacheData, KraxelPriceData };

// Initialize contract registry
let contractRegistry: ContractRegistry | null = null;

// Initialize price series API
let priceSeriesAPI: PriceSeriesAPI | null = null;

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

function getPriceSeriesAPI(): PriceSeriesAPI {
  if (!priceSeriesAPI) {
    // Check if required environment variables are available
    if (!process.env.BLOB_BASE_URL || !process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error(`Price Series API configuration missing. Required environment variables:
        - BLOB_BASE_URL: ${process.env.BLOB_BASE_URL ? '✓' : '✗'}
        - BLOB_READ_WRITE_TOKEN: ${process.env.BLOB_READ_WRITE_TOKEN ? '✓' : '✗'}
        
        Please configure these in your .env.local file to use price series.`);
    }

    const storage = new PriceSeriesStorage(process.env.BLOB_READ_WRITE_TOKEN);
    priceSeriesAPI = new PriceSeriesAPI(storage);
    console.log('[Contract Registry Adapter] Price Series API initialized successfully');
  }
  return priceSeriesAPI;
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
 * Fetches all tokens from contract-registry and adapts them to TokenCacheData format
 */
export async function listTokens(): Promise<TokenCacheData[]> {
  const registry = getContractRegistry();
  
  // Get all contracts with token metadata
  const contracts = await registry.searchContracts({
    contractType: 'token',
    limit: 1000
  });

  console.log(`[Contract Registry Adapter] Raw search result: found ${contracts.contracts?.length || 0} contracts`);

  // Convert to TokenCacheData format
  const tokenData: TokenCacheData[] = contracts.contracts
    .filter(contract => contract.tokenMetadata)
    .map(contract => adaptTokenMetadata(contract.contractId, contract));

  console.log(`[Contract Registry Adapter] Fetched ${tokenData.length} tokens with metadata from contract-registry`);
  
  return tokenData;
}

/**
 * Replacement for getTokenMetadataCached() from @repo/tokens
 * Fetches individual token metadata from contract-registry
 */
export async function getTokenMetadataCached(contractId: string): Promise<TokenCacheData> {
  const registry = getContractRegistry();
  const contract = await registry.getContract(contractId);
  
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
        console.warn(`[getMultipleTokenMetadata] Failed to fetch metadata for ${contractId}:`, error.message);
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
 * Fetches current prices from @services/prices and converts to KraxelPriceData format
 * Uses careful concurrency control to avoid Vercel Blob rate limits
 */
export async function listPrices(): Promise<KraxelPriceData> {
  try {
    const priceAPI = getPriceSeriesAPI();
    
    // Use a more conservative approach with concurrency control
    console.log('[listPrices] Fetching prices with concurrency limiting...');
    
    // Get all current token prices with built-in rate limiting
    const result = await priceAPI.getAllTokens();
    
    if (!result.success || !result.data) {
      console.warn('[listPrices] Failed to get prices from price series:', result.error);
      
      // Fallback: try to get prices in smaller batches
      if (result.error && typeof result.error === 'string' && result.error.includes('Too many requests')) {
        console.log('[listPrices] Rate limited, trying fallback approach...');
        return await getTokenPricesWithFallback();
      }
      
      return {};
    }
    
    // Convert TokenPriceData[] to KraxelPriceData (Record<string, number>)
    const kraxelPrices: KraxelPriceData = {};
    
    result.data.forEach(token => {
      if (token.tokenId && token.usdPrice != null) {
        kraxelPrices[token.tokenId] = token.usdPrice;
      }
    });
    
    console.log(`[Contract Registry Adapter] Fetched ${Object.keys(kraxelPrices).length} token prices from price series`);
    return kraxelPrices;
    
  } catch (error) {
    console.error('[listPrices] Error fetching prices from price series:', error);
    
    // If we hit rate limits, try fallback
    if (error instanceof Error && error.message && error.message.includes('Too many requests')) {
      console.log('[listPrices] Hit rate limit, trying fallback...');
      return await getTokenPricesWithFallback();
    }
    
    return {};
  }
}

/**
 * Fallback price fetching with very conservative concurrency
 */
async function getTokenPricesWithFallback(): Promise<KraxelPriceData> {
  try {
    // Get token list first
    const tokens = await listTokens();
    
    if (tokens.length === 0) {
      console.warn('[getTokenPricesWithFallback] No tokens to fetch prices for');
      return {};
    }
    
    console.log(`[getTokenPricesWithFallback] Fetching prices for ${tokens.length} tokens with strict rate limiting...`);
    
    const kraxelPrices: KraxelPriceData = {};
    const BATCH_SIZE = 3; // Very small batch size to avoid rate limits
    const DELAY_MS = 500; // Longer delay between batches
    
    // Process tokens in very small batches with delays
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      
      // Process batch with individual error handling
      await Promise.all(
        batch.map(async (token, index) => {
          try {
            // Add small delay even within batch
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const priceAPI = getPriceSeriesAPI();
            const result = await priceAPI.getCurrentPrice(token.contractId);
            
            if (result.success && result.data && result.data.usdPrice != null) {
              kraxelPrices[token.contractId] = result.data.usdPrice;
            }
          } catch (error) {
            console.warn(`[getTokenPricesWithFallback] Failed to get price for ${token.contractId}:`, error instanceof Error ? error.message : error);
          }
        })
      );
      
      // Delay between batches
      if (i + BATCH_SIZE < tokens.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    console.log(`[getTokenPricesWithFallback] Successfully fetched ${Object.keys(kraxelPrices).length} prices with rate limiting`);
    return kraxelPrices;
    
  } catch (error) {
    console.error('[getTokenPricesWithFallback] Fallback price fetching failed:', error);
    return {};
  }
}