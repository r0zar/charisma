/**
 * Vercel Cron Job - Price Update Scheduler
 * 
 * Runs every 5 minutes to update price data using the three-engine architecture
 * and store results in Vercel Blob for global consumption.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    PriceServiceOrchestrator,
    OracleEngine,
    CpmmEngine,
    IntrinsicValueEngine,
    PriceSeriesStorage
} from '@services/prices';
import { getHostUrl } from '@modules/discovery';

// Environment validation
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
}

// Cache orchestrator and engines (reuse across invocations)
let orchestrator: PriceServiceOrchestrator | null = null;
let storage: PriceSeriesStorage | null = null;

/**
 * Initialize the price service orchestrator with all engines and providers
 */
async function initializeOrchestrator(): Promise<PriceServiceOrchestrator> {
    if (orchestrator) return orchestrator;

    console.log('[PriceScheduler] Initializing three-engine orchestrator...');

    // Create storage
    storage = new PriceSeriesStorage(BLOB_READ_WRITE_TOKEN);

    // Create engines
    const oracleEngine = new OracleEngine();
    const cpmmEngine = new CpmmEngine();
    const intrinsicEngine = new IntrinsicValueEngine();

    // Set up CPMM engine with pool data provider
    const poolDataProvider = {
        getAllVaultData: async () => {
            console.log('[PriceScheduler] Fetching vault data from invest service...');
            const investUrl = getHostUrl('invest');
            const response = await fetch(`${investUrl}/api/v1/vaults`);
            if (!response.ok) {
                throw new Error(`Failed to fetch vaults: ${response.statusText}`);
            }
            const { data } = await response.json();
            if (!Array.isArray(data)) {
                console.error('[PriceScheduler] Vault data is not an array:', data);
                throw new Error('Vault data is not an array');
            }
            console.log(`[PriceScheduler] Found ${data.length} vaults`);
            return data;
        }
    };
    cpmmEngine.setPoolDataProvider(poolDataProvider);
    await cpmmEngine.buildGraph();

    // Set up intrinsic engine providers
    intrinsicEngine.setOracleEngine(oracleEngine);

    // Token metadata provider (for subnet tokens)
    intrinsicEngine.setTokenMetadataProvider({
        getTokenMetadata: async (contractId: string) => {
            try {
                // Get token metadata from vault data (pools contain token metadata)
                const pools = await poolDataProvider.getAllVaultData();
                // Find token in discovered data
                for (const pool of pools) {
                    if (pool.tokenA?.contractId === contractId) {
                        return {
                            contractId,
                            type: pool.tokenA.type || 'STANDARD',
                            symbol: pool.tokenA.symbol,
                            decimals: pool.tokenA.decimals,
                            base: pool.tokenA.base || null
                        };
                    }
                    if (pool.tokenB?.contractId === contractId) {
                        return {
                            contractId,
                            type: pool.tokenB.type || 'STANDARD',
                            symbol: pool.tokenB.symbol,
                            decimals: pool.tokenB.decimals,
                            base: pool.tokenB.base || null
                        };
                    }
                }
                return null;
            } catch (error) {
                console.warn(`[PriceScheduler] Error getting metadata for ${contractId}:`, error);
                return null;
            }
        }
    });

    // LP provider (for intrinsic LP token calculation)
    intrinsicEngine.setLpProvider({
        getAllVaultData: poolDataProvider.getAllVaultData,
        getRemoveLiquidityQuote: async (contractId: string, amount: number) => {
            try {
                console.log(`[PriceScheduler] Getting remove liquidity quote for ${contractId}, amount: ${amount}`);
                const swapUrl = getHostUrl('swap');
                const response = await fetch(`${swapUrl}/api/v1/quote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'remove-liquidity',
                        contractId,
                        amount: amount.toString()
                    })
                });

                if (!response.ok) {
                    return { success: false, error: `API error: ${response.statusText}` };
                }

                const data = await response.json();
                if (data.success && data.quote) {
                    return {
                        success: true,
                        quote: {
                            dx: parseFloat(data.quote.dx),
                            dy: parseFloat(data.quote.dy)
                        }
                    };
                }

                return { success: false, error: data.error || 'Unknown error' };
            } catch (error) {
                console.error(`[PriceScheduler] Error getting LP quote for ${contractId}:`, error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }
    });

    // Price provider (for recursive pricing in intrinsic engine)
    intrinsicEngine.setPriceProvider({
        getPrice: async (contractId: string) => {
            try {
                // Use our own orchestrator for recursive pricing (avoid infinite loops)
                const result = await orchestrator?.calculateTokenPrice(contractId, {
                    preferredSources: ['oracle', 'market'], // Avoid intrinsic recursion
                    useCache: true
                });

                if (result?.success && result.price) {
                    return { usdPrice: result.price.usdPrice };
                }
                return null;
            } catch (error) {
                console.warn(`[PriceScheduler] Error getting price for ${contractId}:`, error);
                return null;
            }
        }
    });

    // Create orchestrator
    orchestrator = new PriceServiceOrchestrator();
    orchestrator.setOracleEngine(oracleEngine);
    orchestrator.setCpmmEngine(cpmmEngine);
    orchestrator.setIntrinsicEngine(intrinsicEngine);

    console.log('[PriceScheduler] ✅ Orchestrator initialized');
    return orchestrator;
}

/**
 * Discover all tokens that should be priced
 */
async function discoverAllTokens(): Promise<string[]> {
    console.log('[PriceScheduler] Discovering tokens to price...');

    try {
        // Get vault data to discover all known tokens
        const investUrl = getHostUrl('invest');
        const response = await fetch(`${investUrl}/api/v1/vaults`);
        if (!response.ok) {
            throw new Error(`Failed to fetch vaults: ${response.statusText}`);
        }

        const { data } = await response.json();
        if (!Array.isArray(data)) {
            console.error('[PriceScheduler] Vault data is not an array:', data);
            throw new Error('Vault data is not an array');
        }
        const pools = data;
        const tokenSet = new Set<string>();

        // Extract all unique token contract IDs from pools
        pools.forEach((pool: any) => {
            if (pool.tokenA?.contractId) {
                tokenSet.add(pool.tokenA.contractId);
            }
            if (pool.tokenB?.contractId) {
                tokenSet.add(pool.tokenB.contractId);
            }
            // Also include the pool itself if it's an LP token
            if (pool.contractId && pool.type === 'POOL') {
                tokenSet.add(pool.contractId);
            }
        });

        const tokens = Array.from(tokenSet);
        console.log(`[PriceScheduler] Discovered ${tokens.length} unique tokens`);
        return tokens;

    } catch (error) {
        console.error('[PriceScheduler] Error discovering tokens:', error);
        // Fallback to essential tokens
        return [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token'
        ];
    }
}

/**
 * Main cron job handler
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        console.log('[PriceScheduler] 🚀 Starting scheduled price update...');

        // Verify this is a legitimate cron request (Vercel adds this header)
        const authHeader = request.headers.get('authorization');
        if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Initialize orchestrator
        const orch = await initializeOrchestrator();
        if (!storage) {
            throw new Error('Storage not initialized');
        }

        // Discover tokens to price
        const tokens = await discoverAllTokens();
        console.log(`[PriceScheduler] Processing ${tokens.length} tokens...`);

        // Calculate prices using three-engine orchestrator
        const result = await orch.calculateMultipleTokenPrices(tokens, {
            includeArbitrageAnalysis: true,
            batchSize: 10, // Process in smaller batches
            useCache: false // Always get fresh prices
        });

        // Count results
        const successCount = result.prices.size;
        const errorCount = result.errors.size;
        let arbitrageCount = 0;

        result.prices.forEach(price => {
            if (price.arbitrageOpportunity?.profitable) {
                arbitrageCount++;
            }
        });

        // Store in price series
        await storage.storePriceSnapshot({
            timestamp: Date.now(),
            prices: result.prices,
            metadata: {
                engineStats: result.debugInfo?.engineStats || { oracle: 0, market: 0, intrinsic: 0, hybrid: 0 },
                calculationTime: result.debugInfo?.calculationTimeMs,
                arbitrageOpportunities: arbitrageCount,
                totalTokens: tokens.length
            }
        });

        const duration = Date.now() - startTime;
        const summary = {
            success: true,
            timestamp: Date.now(),
            duration,
            tokensProcessed: tokens.length,
            pricesCalculated: successCount,
            errors: errorCount,
            arbitrageOpportunities: arbitrageCount,
            engineStats: result.debugInfo?.engineStats
        };

        console.log('[PriceScheduler] ✅ Update complete:', summary);

        return NextResponse.json(summary);

    } catch (error) {
        const duration = Date.now() - startTime;
        const errorSummary = {
            success: false,
            timestamp: Date.now(),
            duration,
            error: error instanceof Error ? error.message : 'Unknown error'
        };

        console.error('[PriceScheduler] ❌ Update failed:', errorSummary);

        return NextResponse.json(errorSummary, { status: 500 });
    }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
    return GET(request);
}