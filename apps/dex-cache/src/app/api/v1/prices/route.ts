import { NextResponse } from 'next/server';
import { getPriceGraph } from '@/lib/pricing/price-graph';
import { getMultipleTokenPrices, getTokenPrice } from '@/lib/pricing/price-calculator';
import { listVaultTokens } from '@/lib/pool-service';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Cache for 30 seconds on CDN, stale-while-revalidate for 60 seconds
    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
};

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

        console.log('[Prices API] Fetching token prices...');

        // Get all tokens from vault data
        const allTokens = await listVaultTokens();
        
        // Filter by symbols if specified
        const tokensToPrice = symbols.length > 0 
            ? allTokens.filter(token => symbols.includes(token.symbol.toUpperCase()))
            : allTokens;

        // Limit the number of tokens to process
        const limitedTokens = tokensToPrice.slice(0, Math.min(limit, 100));
        const tokenIds = limitedTokens.map(token => token.contractId);

        console.log(`[Prices API] Calculating prices for ${tokenIds.length} tokens`);

        // Calculate prices for all tokens
        const priceMap = await getMultipleTokenPrices(tokenIds);
        
        // Get the price graph to access node-level total liquidity
        const graph = await getPriceGraph();
        
        // Build response data
        const pricesData = Array.from(priceMap.entries())
            .map(([tokenId, priceData]) => {
                // Find token metadata
                const tokenMeta = allTokens.find(t => t.contractId === tokenId);
                
                if (!tokenMeta) {
                    return null;
                }

                // Get node-level total liquidity from the price graph
                const tokenNode = graph.getNode(tokenId);
                const nodeTotalLiquidity = tokenNode?.totalLiquidity || 0;

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
                    totalLiquidity: nodeTotalLiquidity
                };

                // Include detailed path information if requested
                if (includeDetails) {
                    response.calculationDetails = priceData.calculationDetails;
                    
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

        return NextResponse.json({
            status: 'success',
            data: pricesData,
            metadata: {
                count: pricesData.length,
                totalTokensAvailable: allTokens.length,
                processingTimeMs: processingTime,
                minConfidence,
                includeDetails,
                graphStats: includeDetails ? graphStats : undefined
            }
        }, {
            status: 200,
            headers
        });

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