import { NextResponse } from 'next/server';
import { kv } from "@vercel/kv";
import { priceCalculator } from '@/lib/pricing/price-calculator';

// Import the generatePriceData function from our prices API
const PRICES_API_CACHE_KEY = 'prices-api-response-v2';
const PRICES_API_STALE_DURATION_MS = 300 * 1000; // 5 minutes stale-while-revalidate

// Common API parameter combinations to warm
const CACHE_WARMING_CONFIGS = [
    { limit: 50, includeDetails: true, minConfidence: 0, symbols: [] },
    { limit: 100, includeDetails: true, minConfidence: 0, symbols: [] },
    { limit: 50, includeDetails: false, minConfidence: 0, symbols: [] },
    { limit: 50, includeDetails: true, minConfidence: 0.6, symbols: [] }
];

/**
 * Calculate total pool value from vault reserves using underlying token prices
 * @param vault - The vault/pool data
 * @param prices - Current token prices
 * @returns Total pool value in USD, or null if calculation not possible
 */
function calculatePoolValueFromReserves(vault: any, prices: Record<string, number>): number | null {
    if (!vault.tokenA || !vault.tokenB || vault.reservesA === undefined || vault.reservesB === undefined) {
        return null;
    }

    const priceA = prices[vault.tokenA.contractId];
    const priceB = prices[vault.tokenB.contractId];

    if (!priceA || !priceB || vault.reservesA === 0 || vault.reservesB === 0) {
        return null;
    }

    // Calculate token amounts in proper decimal representation
    const tokenADecimals = vault.tokenA.decimals || 6;
    const tokenBDecimals = vault.tokenB.decimals || 6;
    
    const tokenAAmount = vault.reservesA / Math.pow(10, tokenADecimals);
    const tokenBAmount = vault.reservesB / Math.pow(10, tokenBDecimals);

    // Calculate total pool value in USD
    const poolValueA = tokenAAmount * priceA;
    const poolValueB = tokenBAmount * priceB;
    const totalPoolValue = poolValueA + poolValueB;

    return totalPoolValue;
}

export async function GET() {
    return handleWarmPrices();
}

export async function POST() {
    return handleWarmPrices();
}

async function handleWarmPrices() {
    try {
        console.log('[Cron] Starting enhanced price cache warming...');
        const startTime = Date.now();
        
        // Step 1: Warm individual token price cache (existing functionality)
        console.log('[Cron] Warming individual token price cache...');
        await priceCalculator.warmCache();
        const step1Duration = Date.now() - startTime;
        console.log(`[Cron] Individual token cache warmed in ${step1Duration}ms`);
        
        // Step 2: Warm API response cache for common parameter combinations
        console.log('[Cron] Warming API response cache...');
        const apiCacheResults = [];
        
        for (const config of CACHE_WARMING_CONFIGS) {
            try {
                const cacheKeyParams = `${config.limit}-${config.includeDetails}-${config.minConfidence}-${config.symbols.join(',')}`;
                const cacheKey = `${PRICES_API_CACHE_KEY}:${cacheKeyParams}`;
                
                console.log(`[Cron] Warming cache for config: ${cacheKeyParams}`);
                
                // Generate fresh API response data
                const freshData = await generatePriceDataForWarming(config);
                
                // Cache the response
                await kv.set(cacheKey, { data: freshData, timestamp: Date.now() }, { 
                    ex: Math.ceil(PRICES_API_STALE_DURATION_MS / 1000) 
                });
                
                apiCacheResults.push({
                    config: cacheKeyParams,
                    success: true,
                    tokensCount: freshData.data?.length || 0
                });
                
                console.log(`[Cron] Cached API response for ${cacheKeyParams}: ${freshData.data?.length || 0} tokens`);
                
            } catch (configError) {
                console.error(`[Cron] Failed to warm cache for config ${JSON.stringify(config)}:`, configError);
                apiCacheResults.push({
                    config: JSON.stringify(config),
                    success: false,
                    error: configError instanceof Error ? configError.message : 'Unknown error'
                });
            }
        }
        
        const totalDuration = Date.now() - startTime;
        const successfulCaches = apiCacheResults.filter(r => r.success).length;
        
        console.log(`[Cron] Enhanced price cache warming completed in ${totalDuration}ms`);
        console.log(`[Cron] Successfully warmed ${successfulCaches}/${CACHE_WARMING_CONFIGS.length} API response caches`);
        
        return NextResponse.json({
            success: true,
            message: 'Enhanced price cache warming completed',
            data: {
                totalDurationMs: totalDuration,
                individualCacheDurationMs: step1Duration,
                apiCacheResults,
                successfulApiCaches: successfulCaches,
                totalApiCaches: CACHE_WARMING_CONFIGS.length
            }
        });
        
    } catch (error) {
        console.error('[Cron] Enhanced price cache warming failed:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Enhanced price cache warming failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

/**
 * Generate price data for cache warming - simplified version of the API logic
 */
async function generatePriceDataForWarming(config: {
    limit: number;
    includeDetails: boolean;
    minConfidence: number;
    symbols: string[];
}) {
    // Import here to avoid circular dependencies
    const { listVaultTokens, listVaults, getLpTokenMetadata } = await import('@/lib/pool-service');
    const { getMultipleTokenPrices } = await import('@/lib/pricing/price-calculator');
    const { getPriceGraph } = await import('@/lib/pricing/price-graph');
    
    console.log(`[Cache Warming] Generating price data for ${config.limit} tokens...`);
    
    // Simplified version of the API logic for cache warming
    const startTime = Date.now();
    
    // Get all individual tokens from vault data
    const allTokens = await listVaultTokens();
    
    // Get all LP tokens for complete warming coverage
    const allVaults = await listVaults();
    const poolVaults = allVaults.filter(vault => vault.type === 'POOL');
    const sortedVaults = poolVaults
        .sort((a, b) => {
            const aReserves = (a.reservesA || 0) + (a.reservesB || 0);
            const bReserves = (b.reservesA || 0) + (b.reservesB || 0);
            return bReserves - aReserves;
        });
        // Process ALL LP tokens for complete data coverage
        
    const lpTokens = sortedVaults.map(vault => {
        const lpMeta = getLpTokenMetadata(vault);
        return {
            contractId: vault.contractId,
            symbol: lpMeta.symbol,
            name: lpMeta.name,
            decimals: lpMeta.decimals,
            image: vault.image || '',
            description: vault.description || '',
            isLpToken: true
        };
    });
    
    // Combine tokens
    const tokenMap = new Map();
    allTokens.forEach(token => tokenMap.set(token.contractId, token));
    lpTokens.forEach(token => tokenMap.set(token.contractId, token));
    const combinedTokens = Array.from(tokenMap.values());
    
    // Filter by symbols if specified
    const tokensToPrice = config.symbols.length > 0 
        ? combinedTokens.filter(token => config.symbols.includes(token.symbol.toUpperCase()))
        : combinedTokens;
    
    // Limit tokens for processing
    const limitedTokens = tokensToPrice.slice(0, Math.min(config.limit, 100));
    const tokenIds = limitedTokens.map(token => token.contractId);
    
    // Calculate basic prices (skip complex LP dependency processing for faster warming)
    const priceMap = await getMultipleTokenPrices(tokenIds);
    const graph = await getPriceGraph();
    
    // Build simplified response data
    const pricesData = Array.from(priceMap.entries())
        .map(([tokenId, priceData]) => {
            const tokenMeta = combinedTokens.find(t => t.contractId === tokenId);
            if (!tokenMeta) return null;
            
            // Calculate liquidity: use pool value for LP tokens, graph liquidity for regular tokens
            let totalLiquidity = 0;
            
            if (!!(tokenMeta as any).isLpToken) {
                // For LP tokens, calculate pool value from vault reserves
                const vault = sortedVaults.find(v => v.contractId === tokenId);
                if (vault) {
                    // Convert price map to simple prices object for pool calculation
                    const simplePrices: Record<string, number> = {};
                    priceMap.forEach((priceData, tokenId) => {
                        if (priceData.usdPrice > 0) {
                            simplePrices[tokenId] = priceData.usdPrice;
                        }
                    });
                    
                    const poolValue = calculatePoolValueFromReserves(vault, simplePrices);
                    totalLiquidity = poolValue || 0;
                    
                    console.log(`[Cache Warming] LP Token ${tokenId} - Pool Value: $${poolValue?.toLocaleString() || 'N/A'}`);
                }
                
                // Fallback to graph liquidity if pool calculation fails
                if (totalLiquidity === 0) {
                    const tokenNode = graph.getNode(tokenId);
                    totalLiquidity = tokenNode?.totalLiquidity || 0;
                }
            } else {
                // For regular tokens, use graph liquidity
                const tokenNode = graph.getNode(tokenId);
                totalLiquidity = tokenNode?.totalLiquidity || 0;
            }
            
            const response: any = {
                tokenId,
                symbol: tokenMeta.symbol,
                name: tokenMeta.name,
                decimals: tokenMeta.decimals,
                image: tokenMeta.image,
                usdPrice: priceData.usdPrice,
                sbtcRatio: priceData.sbtcRatio,
                confidence: priceData.confidence,
                lastUpdated: priceData.lastUpdated,
                totalLiquidity: totalLiquidity,
                isLpToken: !!(tokenMeta as any).isLpToken,
                intrinsicValue: priceData.intrinsicValue,
                marketPrice: priceData.marketPrice,
                priceDeviation: priceData.priceDeviation,
                isArbitrageOpportunity: priceData.isArbitrageOpportunity,
                nestLevel: priceData.nestLevel
            };
            
            if (config.includeDetails && priceData.calculationDetails) {
                response.calculationDetails = {
                    btcPrice: priceData.calculationDetails.btcPrice,
                    pathsUsed: priceData.calculationDetails.pathsUsed,
                    priceVariation: priceData.calculationDetails.priceVariation,
                    priceSource: priceData.calculationDetails.priceSource
                };
            }
            
            return response;
        })
        .filter(item => item !== null && item.confidence >= config.minConfidence)
        .sort((a, b) => b.confidence - a.confidence);
    
    const processingTime = Date.now() - startTime;
    
    return {
        status: 'success',
        data: pricesData,
        metadata: {
            count: pricesData.length,
            totalTokensAvailable: combinedTokens.length,
            individualTokensAvailable: allTokens.length,
            lpTokensAvailable: lpTokens.length,
            processingTimeMs: processingTime,
            minConfidence: config.minConfidence,
            includeDetails: config.includeDetails,
            warmedFromCron: true
        }
    };
}