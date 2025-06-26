import { NextResponse } from 'next/server';
import { kv } from "@vercel/kv";
import { getPriceGraph } from '@/lib/pricing/price-graph';
import { getMultipleTokenPrices, getTokenPrice } from '@/lib/pricing/price-calculator';
import { listVaultTokens, listVaults, getLpTokenMetadata } from '@/lib/pool-service';

// Cache keys and durations for SWR strategy
const PRICES_API_CACHE_KEY = 'prices-api-response-v2';
const PRICES_API_CACHE_DURATION_MS = 90 * 1000; // 90 seconds (slightly longer than CDN cache)
const PRICES_API_STALE_DURATION_MS = 300 * 1000; // 5 minutes stale-while-revalidate

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // SWR: Fresh for 60s, stale-but-valid for 5 minutes, background revalidation
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
};

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

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    const startTime = Date.now();
    
    try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const includeDetails = url.searchParams.get('details') === 'true';
        const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '0');
        const symbols = url.searchParams.get('symbols')?.split(',').map(s => s.trim()) || [];

        // Create cache key based on request parameters
        const cacheKeyParams = `${limit}-${includeDetails}-${minConfidence}-${symbols.join(',')}`;
        const cacheKey = `${PRICES_API_CACHE_KEY}:${cacheKeyParams}`;

        console.log('[Prices API] Checking cache for fast response...');
        
        // Try to get cached response first (SWR strategy)
        try {
            const cachedResponse = await kv.get(cacheKey);
            if (cachedResponse && typeof cachedResponse === 'object') {
                const cached = cachedResponse as { data: any; timestamp: number };
                const age = Date.now() - cached.timestamp;
                
                // Return fresh cached data immediately
                if (age < PRICES_API_CACHE_DURATION_MS) {
                    console.log(`[Prices API] Serving fresh cached response (${age}ms old)`);
                    return NextResponse.json({
                        ...cached.data,
                        metadata: {
                            ...cached.data.metadata,
                            servedFromCache: true,
                            cacheAge: age
                        }
                    }, { status: 200, headers });
                }
                
                // Return stale data while revalidating in background
                if (age < PRICES_API_STALE_DURATION_MS) {
                    console.log(`[Prices API] Serving stale cached response (${age}ms old), triggering background revalidation`);
                    
                    // Fire-and-forget background revalidation
                    setImmediate(async () => {
                        try {
                            console.log('[Prices API] Background revalidation started');
                            const freshData = await generatePriceData(url, limit, includeDetails, minConfidence, symbols);
                            await kv.set(cacheKey, { data: freshData, timestamp: Date.now() }, { ex: Math.ceil(PRICES_API_STALE_DURATION_MS / 1000) });
                            console.log('[Prices API] Background revalidation completed');
                        } catch (error) {
                            console.error('[Prices API] Background revalidation failed:', error);
                        }
                    });
                    
                    return NextResponse.json({
                        ...cached.data,
                        metadata: {
                            ...cached.data.metadata,
                            servedFromCache: true,
                            cacheAge: age,
                            revalidating: true
                        }
                    }, { status: 200, headers });
                }
            }
        } catch (cacheError) {
            console.warn('[Prices API] Cache lookup failed, proceeding with fresh calculation:', cacheError);
        }

        // Generate fresh data and cache it
        const freshData = await generatePriceData(url, limit, includeDetails, minConfidence, symbols);
        
        // Cache the response for future requests
        try {
            await kv.set(cacheKey, { data: freshData, timestamp: Date.now() }, { ex: Math.ceil(PRICES_API_STALE_DURATION_MS / 1000) });
            console.log('[Prices API] Fresh response cached successfully');
        } catch (cacheError) {
            console.warn('[Prices API] Failed to cache response:', cacheError);
        }

        return NextResponse.json(freshData, { status: 200, headers });

    } catch (error: any) {
        console.error('[Prices API] Error fetching prices:', error);
        
        const processingTime = Date.now() - startTime;
        
        return NextResponse.json({
            status: 'error',
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error?.message : undefined,
            metadata: {
                processingTimeMs: processingTime
            }
        }, {
            status: 500,
            headers
        });
    }
}

/**
 * Generate fresh price data - extracted from main handler for reuse in background jobs
 */
async function generatePriceData(
    url: URL,
    limit: number,
    includeDetails: boolean,
    minConfidence: number,
    symbols: string[]
) {
    const startTime = Date.now();
    
    console.log('[Prices API] Generating fresh price data...');

    // Get all individual tokens from vault data
    const allTokens = await listVaultTokens();
    
    // Get all LP tokens (vault contracts themselves) for complete coverage
    const allVaults = await listVaults();
    
    // Sort vaults by total reserves (as a proxy for liquidity/importance) - process all for complete data
    const poolVaults = allVaults.filter(vault => vault.type === 'POOL');
    console.log(`[Prices API] Found ${poolVaults.length} pool vaults for LP token processing`);
    
    const sortedVaults = poolVaults
        .sort((a, b) => {
            const aReserves = (a.reservesA || 0) + (a.reservesB || 0);
            const bReserves = (b.reservesA || 0) + (b.reservesB || 0);
            return bReserves - aReserves;
        });
        // Process ALL LP tokens for complete data coverage
        
    console.log(`[Prices API] Processing ${sortedVaults.length} LP tokens:`, sortedVaults.map(v => v.contractId));
    
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
    
    // Combine all tokens using Map to deduplicate, with LP tokens taking precedence
    const tokenMap = new Map();
    
    // Add regular tokens first
    allTokens.forEach(token => {
        tokenMap.set(token.contractId, token);
    });
    
    // Add LP tokens second (will override regular tokens if same contractId)
    lpTokens.forEach(token => {
        tokenMap.set(token.contractId, token);
    });
    
    const combinedTokens = Array.from(tokenMap.values());
    
    // Filter by symbols if specified
    const tokensToPrice = symbols.length > 0 
        ? combinedTokens.filter(token => symbols.includes(token.symbol.toUpperCase()))
        : combinedTokens;

        // Limit the number of tokens to process
        const limitedTokens = tokensToPrice.slice(0, Math.min(limit, 100));
        const tokenIds = limitedTokens.map(token => token.contractId);

        console.log(`[Prices API] Calculating prices for ${tokenIds.length} tokens`);

        // Calculate prices for all tokens (regular pricing first)
        const priceMap = await getMultipleTokenPrices(tokenIds);
        
        // Get the price graph to access node-level total liquidity
        const graph = await getPriceGraph();
        
        // Now calculate intrinsic prices for ALL LP tokens using dependency-aware processing
        console.log(`[Prices API] Calculating intrinsic prices for LP tokens with dependency resolution...`);
        const allLpTokenIds = lpTokens.map(t => t.contractId);
        
        console.log(`[Prices API] Processing ${allLpTokenIds.length} LP tokens (including non-tradeable)`);
        
        if (allLpTokenIds.length > 0) {
            // Convert price map to simple price object for base token prices
            const basePrices: Record<string, number> = {};
            priceMap.forEach((priceData, tokenId) => {
                // Only include non-LP tokens as base prices
                const isLpToken = lpTokens.some(lp => lp.contractId === tokenId);
                if (!isLpToken && priceData.usdPrice > 0) {
                    basePrices[tokenId] = priceData.usdPrice;
                }
            });
            
            console.log(`[Prices API] Base prices for dependency calculation: ${Object.keys(basePrices).length} tokens`);
            
            try {
                // Use dependency-aware LP token processing
                const { calculateAllLpIntrinsicValues } = await import('@/lib/pricing/lp-token-calculator');
                console.log(`[Prices API] Processing all LP tokens with dependency resolution...`);
                
                const lpIntrinsicResults = await calculateAllLpIntrinsicValues(basePrices);
                console.log(`[Prices API] Calculated intrinsic values for ${lpIntrinsicResults.size} LP tokens`);
                
                // Update price data with intrinsic values
                lpIntrinsicResults.forEach((intrinsicResult, lpTokenId) => {
                    let priceData = priceMap.get(lpTokenId);
                    
                    // If LP token wasn't in price map (non-tradeable), create new entry
                    if (!priceData) {
                        priceData = {
                            tokenId: lpTokenId,
                            symbol: '',
                            usdPrice: intrinsicResult.usdPrice,
                            sbtcRatio: intrinsicResult.sbtcRatio,
                            confidence: intrinsicResult.confidence,
                            lastUpdated: Date.now(),
                            isLpToken: true,
                            intrinsicValue: intrinsicResult.usdPrice,
                            marketPrice: undefined, // No market price for non-tradeable LP tokens
                            priceDeviation: undefined,
                            isArbitrageOpportunity: false,
                            nestLevel: intrinsicResult.level,
                            calculationDetails: {
                                btcPrice: 0,
                                pathsUsed: 0,
                                totalLiquidity: 0,
                                priceVariation: 0,
                                priceSource: 'intrinsic'
                            }
                        };
                        priceMap.set(lpTokenId, priceData);
                        console.log(`[Prices API] Added non-tradeable LP token ${lpTokenId} - Intrinsic: $${priceData.intrinsicValue?.toFixed(6)}, Level: ${intrinsicResult.level}`);
                    } else if (priceData) {
                        // Update existing tradeable LP token
                        priceData.isLpToken = true;
                        priceData.intrinsicValue = intrinsicResult.usdPrice;
                        priceData.marketPrice = priceData.usdPrice; // The calculated price is market price
                        priceData.nestLevel = intrinsicResult.level;
                        
                        // Calculate deviation if both prices exist
                        if (priceData.marketPrice && priceData.intrinsicValue) {
                            const deviation = ((priceData.marketPrice - priceData.intrinsicValue) / priceData.intrinsicValue) * 100;
                            priceData.priceDeviation = deviation;
                            priceData.isArbitrageOpportunity = Math.abs(deviation) > 5; // >5% deviation
                        }
                        
                        // If no market price exists or confidence is low, use intrinsic as main price
                        if (!priceData.marketPrice || priceData.confidence < 0.5) {
                            priceData.usdPrice = intrinsicResult.usdPrice;
                            priceData.sbtcRatio = intrinsicResult.sbtcRatio;
                            priceData.confidence = Math.max(intrinsicResult.confidence, priceData.confidence);
                            if (priceData.calculationDetails) {
                                priceData.calculationDetails.priceSource = 'intrinsic';
                            }
                        } else {
                            // Use hybrid approach - average market and intrinsic with confidence weighting
                            const marketWeight = priceData.confidence;
                            const intrinsicWeight = intrinsicResult.confidence;
                            const totalWeight = marketWeight + intrinsicWeight;
                            
                            if (totalWeight > 0) {
                                const hybridPrice = (priceData.marketPrice * marketWeight + priceData.intrinsicValue * intrinsicWeight) / totalWeight;
                                priceData.usdPrice = hybridPrice;
                                priceData.confidence = Math.min(0.95, (marketWeight + intrinsicWeight) / 2);
                                if (priceData.calculationDetails) {
                                    priceData.calculationDetails.priceSource = 'hybrid';
                                }
                            }
                        }
                        
                        console.log(`[Prices API] Updated tradeable LP token ${lpTokenId} - Market: $${priceData.marketPrice?.toFixed(6) || 'N/A'}, Intrinsic: $${priceData.intrinsicValue?.toFixed(6)}, Final: $${priceData.usdPrice.toFixed(6)}, Level: ${intrinsicResult.level}`);
                    }
                });
                
            } catch (error) {
                console.error(`[Prices API] Failed to calculate dependency-aware intrinsic prices:`, error instanceof Error ? error.message : error);
                console.error(`[Prices API] Full dependency calculation error:`, error);
                
                // Fallback to individual processing if dependency calculation fails
                console.log(`[Prices API] Falling back to individual LP token processing...`);
                const currentPrices: Record<string, number> = {};
                priceMap.forEach((priceData, tokenId) => {
                    if (priceData.usdPrice > 0) {
                        currentPrices[tokenId] = priceData.usdPrice;
                    }
                });
                
                for (const lpTokenId of allLpTokenIds.slice(0, 5)) { // Limit fallback to prevent timeout
                    const priceData = priceMap.get(lpTokenId);
                    if (priceData) {
                        priceData.isLpToken = true;
                        try {
                            const { calculateLpIntrinsicValue } = await import('@/lib/pricing/lp-token-calculator');
                            const intrinsicResult = await calculateLpIntrinsicValue(lpTokenId, currentPrices);
                            if (intrinsicResult) {
                                priceData.intrinsicValue = intrinsicResult.usdPrice;
                                priceData.marketPrice = priceData.usdPrice;
                                if (!priceData.marketPrice) {
                                    priceData.usdPrice = intrinsicResult.usdPrice;
                                    priceData.sbtcRatio = intrinsicResult.sbtcRatio;
                                    priceData.confidence = Math.max(0.8, priceData.confidence);
                                    if (priceData.calculationDetails) {
                                        priceData.calculationDetails.priceSource = 'intrinsic';
                                    }
                                }
                            }
                        } catch (fallbackError) {
                            console.warn(`[Prices API] Fallback also failed for ${lpTokenId}:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
                        }
                    }
                }
            }
        }
        
        // Build response data
        const pricesData = Array.from(priceMap.entries())
            .map(([tokenId, priceData]) => {
                // Find token metadata from combined list
                const tokenMeta = combinedTokens.find(t => t.contractId === tokenId);
                
                if (!tokenMeta) {
                    return null;
                }

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
                        
                        console.log(`[Prices API] LP Token ${tokenId} - Pool Value: $${poolValue?.toLocaleString() || 'N/A'}`);
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
                    // Enhanced pricing fields
                    isLpToken: !!(tokenMeta as any).isLpToken,
                    intrinsicValue: priceData.intrinsicValue,
                    marketPrice: priceData.marketPrice,
                    priceDeviation: priceData.priceDeviation,
                    isArbitrageOpportunity: priceData.isArbitrageOpportunity,
                    nestLevel: priceData.nestLevel
                };

                // Include detailed path information if requested
                if (includeDetails) {
                    // Clean up calculationDetails to remove misleading totalLiquidity
                    response.calculationDetails = {
                        btcPrice: priceData.calculationDetails?.btcPrice,
                        pathsUsed: priceData.calculationDetails?.pathsUsed,
                        priceVariation: priceData.calculationDetails?.priceVariation,
                        priceSource: priceData.calculationDetails?.priceSource
                        // Note: Removed totalLiquidity as it was the sum of all paths, not token liquidity
                    };
                    
                    // Match single endpoint structure for primaryPath
                    if (priceData.primaryPath) {
                        response.primaryPath = {
                            tokens: priceData.primaryPath.tokens,
                            poolCount: priceData.primaryPath.pools?.length || 0,
                            totalLiquidity: priceData.primaryPath.totalLiquidity,
                            reliability: priceData.primaryPath.reliability,
                            confidence: priceData.primaryPath.confidence,
                            pathLength: priceData.primaryPath.pathLength
                        };
                    } else {
                        response.primaryPath = null;
                    }
                    
                    // Include alternative paths like single endpoint
                    if (priceData.alternativePaths && priceData.alternativePaths.length > 0) {
                        response.alternativePaths = priceData.alternativePaths.map(path => ({
                            tokens: path.tokens,
                            poolCount: path.pools?.length || 0,
                            totalLiquidity: path.totalLiquidity,
                            reliability: path.reliability,
                            confidence: path.confidence,
                            pathLength: path.pathLength
                        }));
                    }
                    response.alternativePathCount = priceData.alternativePaths?.length || 0;
                }

                return response;
            })
            .filter(item => item !== null && item.confidence >= minConfidence)
            .sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending

        // Get graph statistics
        const graphStats = graph.getStats();

        const processingTime = Date.now() - startTime;
        
        console.log(`[Prices API] Returned ${pricesData.length} prices in ${processingTime}ms`);

        return {
            status: 'success',
            data: pricesData,
            metadata: {
                count: pricesData.length,
                totalTokensAvailable: combinedTokens.length,
                individualTokensAvailable: allTokens.length,
                lpTokensAvailable: lpTokens.length,
                processingTimeMs: processingTime,
                minConfidence,
                includeDetails,
                graphStats: includeDetails ? graphStats : undefined
            }
        };
}