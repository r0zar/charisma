import { NextResponse } from 'next/server';
import { getTokenPrice } from '@/lib/pricing/price-calculator';
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

interface RouteParams {
    tokenId: string;
}

export async function GET(
    request: Request,
    { params }: { params: RouteParams }
) {
    const startTime = Date.now();
    
    try {
        const { tokenId } = params;
        const url = new URL(request.url);
        const includeDetails = url.searchParams.get('details') === 'true';

        if (!tokenId) {
            return NextResponse.json({
                status: 'error',
                error: 'Token ID is required'
            }, {
                status: 400,
                headers
            });
        }

        console.log(`[Price API] Fetching price for token: ${tokenId}`);

        // Get token metadata
        const allTokens = await listVaultTokens();
        const tokenMeta = allTokens.find(t => t.contractId === tokenId);

        if (!tokenMeta) {
            return NextResponse.json({
                status: 'error',
                error: 'Token not found',
                message: `Token with ID ${tokenId} not found in liquidity pools`
            }, {
                status: 404,
                headers
            });
        }

        // Calculate price
        const priceData = await getTokenPrice(tokenId);

        if (!priceData) {
            return NextResponse.json({
                status: 'error',
                error: 'Price calculation failed',
                message: 'Unable to calculate price - no liquidity paths found or calculation error'
            }, {
                status: 404,
                headers
            });
        }

        // Build response
        const response: any = {
            tokenId,
            symbol: tokenMeta.symbol,
            name: tokenMeta.name,
            decimals: tokenMeta.decimals,
            image: tokenMeta.image,
            description: tokenMeta.description,
            usdPrice: priceData.usdPrice,
            sbtcRatio: priceData.sbtcRatio,
            confidence: priceData.confidence,
            lastUpdated: priceData.lastUpdated
        };

        // Include detailed information if requested
        if (includeDetails) {
            response.calculationDetails = priceData.calculationDetails;
            
            if (priceData.primaryPath) {
                response.primaryPath = {
                    tokens: priceData.primaryPath.tokens,
                    pools: priceData.primaryPath.pools.map(pool => ({
                        poolId: pool.poolId,
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB,
                        reserveA: pool.reserveA,
                        reserveB: pool.reserveB,
                        fee: pool.fee,
                        lastUpdated: pool.lastUpdated
                    })),
                    totalLiquidity: priceData.primaryPath.totalLiquidity,
                    reliability: priceData.primaryPath.reliability,
                    confidence: priceData.primaryPath.confidence,
                    pathLength: priceData.primaryPath.pathLength
                };
            }

            if (priceData.alternativePaths && priceData.alternativePaths.length > 0) {
                response.alternativePaths = priceData.alternativePaths.map(path => ({
                    tokens: path.tokens,
                    poolCount: path.pools.length,
                    totalLiquidity: path.totalLiquidity,
                    reliability: path.reliability,
                    confidence: path.confidence,
                    pathLength: path.pathLength
                }));
            }
        }

        const processingTime = Date.now() - startTime;
        
        console.log(`[Price API] Calculated ${tokenMeta.symbol} price in ${processingTime}ms: $${priceData.usdPrice.toFixed(6)}`);

        return NextResponse.json({
            status: 'success',
            data: response,
            metadata: {
                processingTimeMs: processingTime,
                includeDetails
            }
        }, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error(`[Price API] Error fetching price for ${params.tokenId}:`, error);
        
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