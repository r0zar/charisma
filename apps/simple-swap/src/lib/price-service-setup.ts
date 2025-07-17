/**
 * Price Service Integration for Simple-Swap App
 * 
 * This file sets up the unified price service for the simple-swap app,
 * implementing the necessary adapters to connect with existing vault/liquidity providers.
 */

import {
  PriceService,
  VaultLiquidityProvider,
  type PoolDataProvider,
  type Vault as PriceServiceVault
} from '@services/price-service';
import { listTokens as listAllTokens } from '@repo/tokens';
import { Router, loadVaults } from 'dexterity-sdk';

// Simple-swap uses dexterity SDK for liquidity operations
const routerAddress = process.env.NEXT_PUBLIC_ROUTER_ADDRESS || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const routerName = process.env.NEXT_PUBLIC_ROUTER_NAME || 'multihop';

const router = new Router({
  maxHops: 4,
  defaultSlippage: 0.05,
  debug: process.env.NODE_ENV === 'development',
  routerContractId: `${routerAddress}.${routerName}`,
});

let vaultsLoaded = false;

/**
 * Pool Data Provider Implementation for Simple-Swap
 * 
 * This adapter connects the price service to simple-swap's pool data sources.
 * Since simple-swap primarily uses dexterity SDK, we adapt its data format.
 */
class SimpleSwapPoolDataProvider implements PoolDataProvider {
  async getAllVaultData(): Promise<any[]> {
    // Ensure vaults are loaded from dexterity SDK
    if (!vaultsLoaded) {
      await loadVaults(router);
      vaultsLoaded = true;
    }

    // Get available tokens and their relationships from dexterity
    const tokenIds = router.tokenContractIds();
    
    // Limit the scope to prevent excessive calculations
    const maxTokens = 10; // Drastically limit to prevent O(n²) explosion
    const limitedTokenIds = tokenIds.slice(0, maxTokens);
    
    console.log(`[SimpleSwapPoolDataProvider] Processing ${limitedTokenIds.length} tokens (limited from ${tokenIds.length})`);
    
    // Convert dexterity router data to vault format expected by price service
    const vaults: any[] = [];
    
    // Only create pools for most important tokens to reduce calculation time
    const importantTokens = limitedTokenIds.filter(tokenId => 
      tokenId.includes('charisma-token') || 
      tokenId.includes('sbtc') || 
      tokenId.includes('usda') ||
      tokenId.includes('sBTC') ||
      tokenId.includes('synthetic-btc')
    );
    
    // If no important tokens found, just use first few
    const tokensToProcess = importantTokens.length > 0 ? importantTokens : limitedTokenIds.slice(0, 5);
    
    // Create mock vault data for important token pairs only (not all combinations)
    for (let i = 0; i < Math.min(tokensToProcess.length, 3); i++) {
      for (let j = i + 1; j < Math.min(tokensToProcess.length, 3); j++) {
        const tokenA = tokensToProcess[i];
        const tokenB = tokensToProcess[j];
        
        vaults.push({
          contractId: `${tokenA}-${tokenB}-pool`, // Mock ID
          type: 'POOL',
          tokenA: { contractId: tokenA, symbol: tokenA.split('.')[1]?.toUpperCase() || 'TOKEN' },
          tokenB: { contractId: tokenB, symbol: tokenB.split('.')[1]?.toUpperCase() || 'TOKEN' },
          decimals: 6,
          reserveA: 1000000, // Mock reserves - would get real data in production
          reserveB: 1000000,
        });
      }
    }
    
    console.log(`[SimpleSwapPoolDataProvider] Created ${vaults.length} mock vault entries`);
    return vaults;
  }
}

/**
 * Liquidity Provider Implementation for Simple-Swap
 * 
 * This adapter implements LP token operations using simple-swap's existing infrastructure.
 * For remove liquidity quotes, we'd typically call dexterity SDK functions.
 */
class SimpleSwapLiquidityProvider implements VaultLiquidityProvider {
  async getAllVaultData(): Promise<PriceServiceVault[]> {
    // Reuse the pool data provider logic
    const poolProvider = new SimpleSwapPoolDataProvider();
    const rawVaults = await poolProvider.getAllVaultData();

    // Convert to PriceServiceVault format
    return rawVaults.map(vault => ({
      contractId: vault.contractId,
      type: vault.type,
      decimals: vault.decimals,
      tokenA: vault.tokenA,
      tokenB: vault.tokenB,
    }));
  }

  async getRemoveLiquidityQuote(
    contractId: string,
    amount: number
  ): Promise<{ success: boolean; quote?: { dx: number; dy: number }; error?: string }> {
    try {
      // In simple-swap, we'd use dexterity SDK for liquidity operations
      // For now, implement a mock since direct LP operations aren't the primary use case

      // In a full implementation, you'd:
      // 1. Parse the contractId to identify the actual vault/pool
      // 2. Use dexterity SDK or direct contract calls to get the quote
      // 3. Return the actual liquidity amounts

      console.warn(`[SimpleSwapLiquidityProvider] Remove liquidity quote not fully implemented for ${contractId}`);

      return {
        success: false,
        error: 'Remove liquidity quotes not implemented for simple-swap adapter'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Initialize and configure the price service for simple-swap
 */
async function createPriceService(): Promise<PriceService> {
  const poolDataProvider = new SimpleSwapPoolDataProvider();
  const liquidityProvider = new SimpleSwapLiquidityProvider();

  // Get BLOB token from environment - this ensures it's accessible from the app context
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
  }

  // Configure the price service with simple-swap specific settings
  const config = {
    btcOracle: {
      sources: ['coingecko', 'kraken'] as const,
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeout: 60000
      }
    },
    cache: {
      tokenPriceDuration: 10 * 60 * 1000,  // 10 minutes for simple-swap (more frequent updates)
      bulkPriceDuration: 15 * 60 * 1000,   // 15 minutes for bulk operations
      calculationDuration: 5 * 60 * 1000   // 5 minutes for individual calculations
    },
    pricing: {
      minLiquidity: 1000,
      maxPathLength: 4,       // Match dexterity router maxHops
      confidenceThreshold: 0.3,
      priceDeviationThreshold: 0.5
    },
    storage: {
      blobPrefix: 'simple-swap-prices/',
      compressionEnabled: true,
      retentionDays: 30      // Shorter retention for simple-swap
    }
  };

  const priceService = new PriceService(config, poolDataProvider, liquidityProvider, blobToken);

  // Initialize the service
  await priceService.initialize();

  return priceService;
}

// Singleton instance
let priceServiceInstance: PriceService | null = null;

/**
 * Get the configured price service instance for simple-swap
 * 
 * Usage in API routes:
 * ```typescript
 * import { getPriceService } from '@/lib/price-service-setup';
 * 
 * export async function GET() {
 *   const priceService = await getPriceService();
 *   const result = await priceService.calculateBulkPrices(['token1', 'token2']);
 *   return NextResponse.json(result);
 * }
 * ```
 */
export async function getPriceService(): Promise<PriceService> {
  if (!priceServiceInstance) {
    priceServiceInstance = await createPriceService();
  }
  return priceServiceInstance;
}

/**
 * Force recreation of the price service instance
 * Useful for development or when configuration changes
 */
export async function resetPriceService(): Promise<void> {
  priceServiceInstance = null;
}

/**
 * Helper function to get token prices in the format expected by simple-swap components
 */
export async function getTokenPricesForUI(tokenIds: string[]): Promise<{
  [contractId: string]: {
    usdPrice: number;
    change24h?: number;
    isLpToken?: boolean;
    intrinsicValue?: number;
    marketPrice?: number;
    confidence: number;
  }
}> {
  const priceService = await getPriceService();
  const result = await priceService.calculateBulkPrices(tokenIds);

  if (!result.success) {
    console.error('[Price Service] Bulk price calculation failed:', result.errors);
    return {};
  }

  const formattedPrices: any = {};

  result.prices.forEach((priceData, contractId) => {
    formattedPrices[contractId] = {
      usdPrice: priceData.usdPrice,
      change24h: undefined, // Would calculate from historical data
      isLpToken: priceData.isLpToken,
      intrinsicValue: priceData.intrinsicValue,
      marketPrice: priceData.marketPrice,
      confidence: priceData.confidence,
    };
  });

  return formattedPrices;
}

/**
 * Get a single token price with full details
 */
export async function getTokenPriceDetails(tokenId: string) {
  const priceService = await getPriceService();
  return await priceService.calculateTokenPrice(tokenId);
}

export { router, vaultsLoaded };