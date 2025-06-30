/**
 * Centralized Token Metadata Library
 * 
 * Responsible for aggregating token and LP token metadata from all possible sources
 * and providing a unified, comprehensive token registry for the balance system.
 * 
 * Data Sources:
 * 1. Dex-Cache API (invest.charisma.rocks) - Primary LP token source
 * 2. Simple-Swap API (swap.charisma.rocks) - Alternative token source  
 * 3. Token-Cache Service (tokens.charisma.rocks) - Base metadata
 * 4. Local/Environment Token APIs - Development sources
 * 5. Hardcoded Known Tokens - Fallback for critical tokens
 */

import { listTokens, fetchMetadata } from '@repo/tokens';
import {
  getTokenSources,
  CRITICAL_TOKENS,
  SUBNET_MAPPINGS,
  type TokenSource
} from './token-metadata-config';

// Base token metadata interface
interface BaseTokenMetadata {
  contractId: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  image?: string;
  description?: string;
  identifier?: string;
  type?: string;
  total_supply?: string;
  token_uri?: string;
  lastUpdated?: number;
  tokenAContract?: string;
  tokenBContract?: string;
  lpRebatePercent?: number;
  externalPoolId?: string;
  engineContractId?: string;
  base?: string;
  verified?: boolean;
}

// Enhanced token metadata interface with all possible fields
export interface EnhancedTokenMetadata extends BaseTokenMetadata {
  // Base fields from @repo/tokens
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  image?: string;
  description?: string;
  identifier?: string;
  type?: 'SIP10' | 'SUBNET' | 'LP';

  // Enhanced pricing and market data
  price?: number;
  usdPrice?: number;
  change1h?: number;
  change24h?: number;
  change7d?: number;
  marketCap?: number;
  totalSupply?: string;
  totalLiquidity?: number;
  confidence?: number;
  verified?: boolean;

  // LP token specific fields
  tokenAContract?: string;
  tokenBContract?: string;
  lpRebatePercent?: number;
  externalPoolId?: string;
  engineContractId?: string;
  reserves?: {
    tokenA: string;
    tokenB: string;
  };

  // Subnet token fields
  base?: string; // Base contract for subnet tokens
  subnetContractId?: string;

  // Metadata tracking
  source?: string; // Which API provided this data
  lastUpdated?: number;
  nestLevel?: number; // For LP token nesting
}


// Get environment-aware token sources (will be refreshed dynamically)
let TOKEN_SOURCES: TokenSource[] = getTokenSources();

/**
 * Refresh token sources configuration (useful for environment changes)
 */
export function refreshTokenSources(): TokenSource[] {
  TOKEN_SOURCES = getTokenSources();
  console.log('🔄 Refreshed token sources configuration');
  console.log(`   Active sources: ${TOKEN_SOURCES.length}`);
  TOKEN_SOURCES.forEach(source => {
    console.log(`   - ${source.name} (priority: ${source.priority}): ${source.url}`);
  });
  return TOKEN_SOURCES;
}

/**
 * Get current token sources configuration
 */
export function getActiveTokenSources(): TokenSource[] {
  return [...TOKEN_SOURCES]; // Return copy to prevent mutation
}


/**
 * Fetch token data from a single source with error handling
 */
async function fetchFromSource(source: TokenSource): Promise<{
  tokens: EnhancedTokenMetadata[],
  source: string
}> {
  if (!source.enabled) {
    return { tokens: [], source: source.name };
  }

  try {
    console.log(`🔍 Fetching tokens from ${source.name}: ${source.url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), source.timeout);

    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'charisma-party-token-aggregator'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse response based on source format
    let tokens: EnhancedTokenMetadata[] = [];

    if (Array.isArray(data)) {
      // Simple array format (like simple-swap API)
      tokens = data.map(token => ({
        ...token,
        source: source.name,
        lastUpdated: Date.now()
      }));
    } else if (data.tradeableTokens && data.lpTokens) {
      // Structured format (like dex-cache API)
      tokens = [
        ...data.tradeableTokens.map((token: any) => ({
          ...token,
          source: source.name,
          lastUpdated: Date.now()
        })),
        ...data.lpTokens.map((token: any) => ({
          ...token,
          type: 'LP' as const,
          source: source.name,
          lastUpdated: Date.now()
        }))
      ];
    } else {
      console.warn(`⚠️  Unknown response format from ${source.name}`);
      return { tokens: [], source: source.name };
    }

    console.log(`✅ Fetched ${tokens.length} tokens from ${source.name}`);
    return { tokens, source: source.name };

  } catch (error) {
    console.error(`❌ Failed to fetch from ${source.name}:`, error);
    return { tokens: [], source: source.name };
  }
}

/**
 * Merge token metadata from multiple sources, prioritizing by source reliability
 */
function mergeTokenData(sources: { tokens: EnhancedTokenMetadata[], source: string }[]): Map<string, EnhancedTokenMetadata> {
  const mergedTokens = new Map<string, EnhancedTokenMetadata>();

  // Start with critical tokens as base
  CRITICAL_TOKENS.forEach((metadata, contractId) => {
    mergedTokens.set(contractId, {
      contractId,
      name: 'Unknown Token',
      symbol: 'TKN',
      decimals: 6,
      ...metadata,
      source: 'critical-tokens',
      lastUpdated: Date.now()
    });
  });

  // Sort sources by priority (highest first)
  const sortedSources = sources.sort((a, b) => {
    const priorityA = TOKEN_SOURCES.find(s => s.name === a.source)?.priority || 0;
    const priorityB = TOKEN_SOURCES.find(s => s.name === b.source)?.priority || 0;
    return priorityB - priorityA;
  });

  // Merge tokens, with higher priority sources overriding lower priority ones
  for (const { tokens, source } of sortedSources) {
    for (const token of tokens) {
      const contractId = token.contractId;
      const existing = mergedTokens.get(contractId);

      if (!existing) {
        // New token
        mergedTokens.set(contractId, { ...token, source });
      } else {
        // Merge with existing, keeping higher priority data but filling gaps
        const merged: EnhancedTokenMetadata = {
          ...existing,
          // Override with new data if it's more complete or from higher priority source
          name: token.name || existing.name,
          symbol: token.symbol || existing.symbol,
          decimals: token.decimals ?? existing.decimals,
          image: token.image || existing.image,
          description: token.description || existing.description,
          type: token.type || existing.type,

          // Price data - always take latest if available
          price: token.price ?? existing.price,
          usdPrice: token.usdPrice ?? existing.usdPrice,
          change1h: token.change1h ?? existing.change1h,
          change24h: token.change24h ?? existing.change24h,
          change7d: token.change7d ?? existing.change7d,
          marketCap: token.marketCap ?? existing.marketCap,
          totalSupply: token.totalSupply || existing.totalSupply,
          totalLiquidity: token.totalLiquidity ?? existing.totalLiquidity,

          // LP token data
          tokenAContract: token.tokenAContract || existing.tokenAContract,
          tokenBContract: token.tokenBContract || existing.tokenBContract,
          lpRebatePercent: token.lpRebatePercent ?? existing.lpRebatePercent,
          externalPoolId: token.externalPoolId || existing.externalPoolId,
          engineContractId: token.engineContractId || existing.engineContractId,
          reserves: token.reserves || existing.reserves,

          // Metadata
          verified: token.verified ?? existing.verified,
          confidence: Math.max(token.confidence || 0, existing.confidence || 0),
          lastUpdated: Math.max(token.lastUpdated || 0, existing.lastUpdated || 0),
          source: existing.source // Keep original source for tracking
        };

        mergedTokens.set(contractId, merged);
      }
    }
  }

  return mergedTokens;
}

/**
 * Generate synthetic subnet token metadata based on base tokens
 */
function generateSubnetTokens(baseTokens: Map<string, EnhancedTokenMetadata>): Map<string, EnhancedTokenMetadata> {
  const subnetTokens = new Map<string, EnhancedTokenMetadata>();

  for (const [subnetId, baseId] of SUBNET_MAPPINGS) {
    const baseToken = baseTokens.get(baseId);
    if (baseToken) {
      const subnetToken: EnhancedTokenMetadata = {
        ...baseToken,
        contractId: subnetId,
        name: `${baseToken.name} (Subnet)`,
        symbol: baseToken.symbol,
        type: 'SUBNET',
        base: baseId,
        subnetContractId: subnetId,
        source: 'synthetic-subnet',
        lastUpdated: Date.now()
      };

      subnetTokens.set(subnetId, subnetToken);
    }
  }

  return subnetTokens;
}

/**
 * Main function to load and merge all token metadata
 */
export async function loadAllTokenMetadata(): Promise<Map<string, EnhancedTokenMetadata>> {
  console.log('🚀 Starting comprehensive token metadata loading...');

  // Log environment configuration
  const isDev = process.env.NODE_ENV === 'development';

  console.log('🌍 Environment configuration:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   Environment type: ${isDev ? 'Development' : 'Production'}`);
  console.log(`   Active token sources: ${TOKEN_SOURCES.length}`);

  // Log all active sources
  TOKEN_SOURCES.forEach(source => {
    console.log(`   📡 ${source.name} (priority: ${source.priority}): ${source.url}`);
  });

  const startTime = Date.now();

  // Fetch from all sources in parallel
  const sourcePromises = TOKEN_SOURCES.map(source => fetchFromSource(source));
  const sourceResults = await Promise.allSettled(sourcePromises);

  // Extract successful results
  const successfulSources = sourceResults
    .filter((result): result is PromiseFulfilledResult<{ tokens: EnhancedTokenMetadata[], source: string }> =>
      result.status === 'fulfilled')
    .map(result => result.value);

  console.log(`📊 Source summary:`);
  successfulSources.forEach(({ tokens, source }) => {
    const lpCount = tokens.filter(t => t.type === 'LP' || t.tokenAContract).length;
    const regularCount = tokens.length - lpCount;
    console.log(`  ${source}: ${tokens.length} total (${regularCount} regular, ${lpCount} LP)`);
  });

  // Merge all token data
  const mergedTokens = mergeTokenData(successfulSources);

  // Generate synthetic subnet tokens
  const subnetTokens = generateSubnetTokens(mergedTokens);

  // Combine mainnet and subnet tokens
  const allTokens = new Map([...mergedTokens, ...subnetTokens]);

  // Add fallback metadata from @repo/tokens for any missing tokens
  try {
    const repoTokens = await listTokens();
    const repoMetadata = await fetchMetadata();

    for (const repoToken of repoTokens) {
      if (!allTokens.has(repoToken.contractId)) {
        const metadata = repoMetadata.find(m => m.contractId === repoToken.contractId);
        allTokens.set(repoToken.contractId, {
          ...repoToken,
          ...metadata,
          source: 'repo-tokens-fallback',
          lastUpdated: Date.now()
        });
      }
    }
  } catch (error) {
    console.warn('⚠️  Failed to load @repo/tokens fallback data:', error);
  }

  const endTime = Date.now();
  const lpTokenCount = Array.from(allTokens.values()).filter(t => t.type === 'LP' || t.tokenAContract).length;
  const subnetTokenCount = Array.from(allTokens.values()).filter(t => t.type === 'SUBNET').length;
  const regularTokenCount = allTokens.size - lpTokenCount - subnetTokenCount;

  console.log(`✅ Token metadata loading complete in ${endTime - startTime}ms:`);
  console.log(`   Total tokens: ${allTokens.size}`);
  console.log(`   Regular tokens: ${regularTokenCount}`);
  console.log(`   LP tokens: ${lpTokenCount}`);
  console.log(`   Subnet tokens: ${subnetTokenCount}`);

  return allTokens;
}

/**
 * Get metadata for a specific token
 */
export function getTokenMetadata(contractId: string, allTokens: Map<string, EnhancedTokenMetadata>): EnhancedTokenMetadata | undefined {
  return allTokens.get(contractId);
}

/**
 * Get all LP tokens
 */
export function getLPTokens(allTokens: Map<string, EnhancedTokenMetadata>): EnhancedTokenMetadata[] {
  return Array.from(allTokens.values()).filter(token =>
    token.type === 'LP' || token.tokenAContract
  );
}

/**
 * Get all subnet tokens
 */
export function getSubnetTokens(allTokens: Map<string, EnhancedTokenMetadata>): EnhancedTokenMetadata[] {
  return Array.from(allTokens.values()).filter(token => token.type === 'SUBNET');
}

/**
 * Get token statistics
 */
export function getTokenStats(allTokens: Map<string, EnhancedTokenMetadata>) {
  const tokens = Array.from(allTokens.values());
  const sources = new Set(tokens.map(t => t.source));

  return {
    total: tokens.length,
    regular: tokens.filter(t => t.type === 'SIP10' || (!t.type && !t.tokenAContract)).length,
    lp: tokens.filter(t => t.type === 'LP' || t.tokenAContract).length,
    subnet: tokens.filter(t => t.type === 'SUBNET').length,
    sources: Array.from(sources),
    verified: tokens.filter(t => t.verified).length,
    withPricing: tokens.filter(t => t.price || t.usdPrice).length
  };
}

// Export types and constants for external use
export { SUBNET_MAPPINGS, CRITICAL_TOKENS } from './token-metadata-config';
export type { TokenSource };