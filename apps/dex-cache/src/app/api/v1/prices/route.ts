import { NextResponse } from 'next/server';
import { PriceSeriesStorage } from '@services/prices';
import { listVaultTokens, listVaults, getLpTokenMetadata } from '@/lib/pool-service';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // SWR: Fresh for 5min, stale-but-valid for 15 minutes, background revalidation
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900'
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

        console.log('[Prices API] Generating fresh price data using optimized latest snapshot...');

        // Generate fresh data using optimized latest snapshot approach
        const freshData = await generatePriceDataOptimized(url, limit, includeDetails, minConfidence, symbols);

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
 * OPTIMIZED: Generate fresh price data using latest snapshot directly
 * This avoids the expensive historical snapshot crawling and uses the pre-calculated latest prices
 */
async function generatePriceDataOptimized(
    url: URL,
    limit: number,
    includeDetails: boolean,
    minConfidence: number,
    symbols: string[]
) {
    const startTime = Date.now();

    console.log('[Prices API] Using optimized latest snapshot approach...');

    // Get all individual tokens from vault data
    const allTokens = await listVaultTokens();

    // Get all LP tokens (vault contracts themselves) for complete coverage
    const allVaults = await listVaults();

    // Sort vaults by total reserves (as a proxy for liquidity/importance)
    const poolVaults = allVaults.filter(vault => vault.type === 'POOL');
    console.log(`[Prices API] Found ${poolVaults.length} pool vaults for LP token processing`);

    const sortedVaults = poolVaults
        .sort((a, b) => {
            const aReserves = (a.reservesA || 0) + (a.reservesB || 0);
            const bReserves = (b.reservesA || 0) + (b.reservesB || 0);
            return bReserves - aReserves;
        });

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

    console.log(`[Prices API] Getting latest snapshot for ${tokenIds.length} tokens...`);

    // OPTIMIZED: Use latest snapshot directly instead of orchestrator's expensive calculations
    const storage = new PriceSeriesStorage();
    const latestSnapshot = await storage.getLatestSnapshot();

    if (!latestSnapshot) {
        // Fallback: try to get all current prices from KV
        console.log('[Prices API] No latest snapshot available, trying KV fallback...');
        const allCurrentPrices = await storage.getAllCurrentPrices();

        if (allCurrentPrices.size === 0) {
            throw new Error('No current price data available from snapshot or KV');
        }

        // Create a minimal snapshot-like structure from KV data
        const kvSnapshot = {
            timestamp: Date.now(),
            prices: allCurrentPrices,
            metadata: {
                totalTokens: allCurrentPrices.size,
                dataSource: 'kv-fallback'
            }
        };

        return buildResponseFromSnapshot(kvSnapshot, combinedTokens, limitedTokens, lpTokens, sortedVaults, includeDetails, minConfidence, startTime);
    }

    console.log(`[Prices API] Retrieved latest snapshot with ${latestSnapshot.prices.size} prices (age: ${Math.round((Date.now() - latestSnapshot.timestamp) / 1000)}s)`);

    return buildResponseFromSnapshot(latestSnapshot, combinedTokens, limitedTokens, lpTokens, sortedVaults, includeDetails, minConfidence, startTime);
}

/**
 * Build the API response from snapshot data
 */
function buildResponseFromSnapshot(
    snapshot: any,
    combinedTokens: any[],
    limitedTokens: any[],
    lpTokens: any[],
    sortedVaults: any[],
    includeDetails: boolean,
    minConfidence: number,
    startTime: number
) {
    // Convert snapshot to price map format
    const priceMap = new Map();

    snapshot.prices.forEach((priceData: any, tokenId: string) => {
        // Only include tokens we actually want to return
        if (limitedTokens.some(t => t.contractId === tokenId)) {
            priceMap.set(tokenId, {
                tokenId,
                symbol: priceData.symbol || '',
                usdPrice: priceData.usdPrice || 0,
                sbtcRatio: priceData.sbtcRatio || 0,
                confidence: priceData.reliability || 0.5, // Use reliability as confidence
                lastUpdated: snapshot.timestamp,
                isLpToken: lpTokens.some(lp => lp.contractId === tokenId),
                // Enhanced pricing fields from snapshot
                intrinsicValue: priceData.virtualData?.sourceData?.intrinsicValue || 0,
                marketPrice: priceData.marketData?.primaryPath ? priceData.usdPrice : undefined,
                priceDeviation: priceData.arbitrageOpportunity?.deviation,
                isArbitrageOpportunity: priceData.arbitrageOpportunity?.profitable || false,
                nestLevel: 0, // Could be derived from virtual data if needed
                calculationDetails: {
                    btcPrice: snapshot.metadata?.engineStats ?
                        getBtcPriceFromSnapshot(snapshot) : 0,
                    pathsUsed: priceData.marketData?.pathsUsed || 0,
                    totalLiquidity: priceData.marketData?.totalLiquidity || 0,
                    priceVariation: priceData.marketData?.priceVariation || 0,
                    priceSource: priceData.source || 'snapshot'
                },
                primaryPath: priceData.marketData?.primaryPath,
                alternativePaths: priceData.marketData?.alternativePaths || []
            });
        }
    });

    // Add missing tokens with zero prices (for UI consistency)
    combinedTokens.forEach(token => {
        if (!priceMap.has(token.contractId)) {
            priceMap.set(token.contractId, {
                tokenId: token.contractId,
                symbol: token.symbol,
                usdPrice: 0,
                sbtcRatio: 0,
                confidence: 0,
                lastUpdated: snapshot.timestamp,
                isLpToken: !!(token as any).isLpToken,
                intrinsicValue: 0,
                marketPrice: undefined,
                priceDeviation: undefined,
                isArbitrageOpportunity: false,
                nestLevel: 0,
                calculationDetails: {
                    btcPrice: 0,
                    pathsUsed: 0,
                    totalLiquidity: 0,
                    priceVariation: 0,
                    priceSource: 'unavailable'
                }
            });
        }
    });

    // Build response data
    const pricesData = Array.from(priceMap.entries())
        .map(([tokenId, priceData]) => {
            // Find token metadata from combined list
            const tokenMeta = combinedTokens.find(t => t.contractId === tokenId);

            if (!tokenMeta) {
                return null;
            }

            // Calculate liquidity: use snapshot data or pool value calculation
            let totalLiquidity = priceData.calculationDetails?.totalLiquidity || 0;

            if ((tokenMeta as any).isLpToken && totalLiquidity === 0) {
                // For LP tokens, calculate pool value from vault reserves as fallback
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
                }
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
                response.calculationDetails = {
                    btcPrice: priceData.calculationDetails?.btcPrice,
                    pathsUsed: priceData.calculationDetails?.pathsUsed,
                    priceVariation: priceData.calculationDetails?.priceVariation,
                    priceSource: priceData.calculationDetails?.priceSource
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

                // Include alternative paths
                if (priceData.alternativePaths && priceData.alternativePaths.length > 0) {
                    response.alternativePaths = priceData.alternativePaths.map((path: any) => ({
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

    const processingTime = Date.now() - startTime;
    const snapshotAge = Date.now() - snapshot.timestamp;

    console.log(`[Prices API] Optimized approach completed in ${processingTime}ms (snapshot age: ${Math.round(snapshotAge / 1000)}s)`);

    return {
        status: 'success',
        data: pricesData,
        metadata: {
            count: pricesData.length,
            totalTokensAvailable: combinedTokens.length,
            individualTokensAvailable: pricesData.filter(p => !p.isLpToken).length,
            lpTokensAvailable: pricesData.filter(p => p.isLpToken).length,
            processingTimeMs: processingTime,
            minConfidence,
            includeDetails,
            optimizedSnapshot: true,
            snapshotTimestamp: snapshot.timestamp,
            snapshotAge: snapshotAge,
            dataSource: snapshot.metadata?.dataSource || 'snapshot'
        }
    };
}

/**
 * Extract BTC price from snapshot for metadata
 */
function getBtcPriceFromSnapshot(snapshot: any): number {
    const SBTC_CONTRACT_ID = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
    const sbtcData = snapshot.prices.get(SBTC_CONTRACT_ID);
    return sbtcData?.usdPrice || 0;
}