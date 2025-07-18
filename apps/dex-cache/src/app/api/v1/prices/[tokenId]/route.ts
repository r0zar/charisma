import { NextResponse } from 'next/server';
import { listVaultTokens } from '@/lib/pool-service';
import { PriceSeriesAPI, PriceSeriesStorage } from '@services/prices';

const priceSeriesService = new PriceSeriesAPI(new PriceSeriesStorage());

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Extended cache for bandwidth optimization: 5min fresh, 15min stale
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900'
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
        const priceData = await priceSeriesService.getCurrentPrice(tokenId);

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

        const processingTime = Date.now() - startTime;

        console.log(`[Price API] Calculated ${tokenMeta.symbol} price in ${processingTime}ms: $${priceData.data?.usdPrice.toFixed(6)}`);

        return NextResponse.json({
            status: 'success',
            data: priceData.data,
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