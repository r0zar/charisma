import { NextResponse } from 'next/server';
import { fetchPrices, toInvestPrice } from '@/lib/prices-api';

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
    { params }: { params: Promise<RouteParams> }
) {
    const startTime = Date.now();

    try {
        const { tokenId } = await params;
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

        const [priced] = (await fetchPrices([tokenId])).tokens;
        if (!priced) {
            return NextResponse.json({
                status: 'error',
                error: 'Token not found',
                message: `Token with ID ${tokenId} not found in price data`
            }, {
                status: 404,
                headers
            });
        }

        const processingTime = Date.now() - startTime;
        const transformedData = toInvestPrice(priced);

        // Add calculation details if requested
        if (includeDetails) {
            (transformedData as any).calculationDetails = {
                priceSource: 'prices.charisma.rocks',
                roundTripLossPercent: priced.roundTripLoss,
                calculatedAt: priced.updatedAt
            };
        }

        console.log(`[Price API] Retrieved ${priced.symbol} price in ${processingTime}ms: $${priced.usd}`)

        return NextResponse.json({
            status: 'success',
            data: transformedData,
            metadata: {
                processingTimeMs: processingTime,
                includeDetails,
                source: 'prices.charisma.rocks',
                lastUpdated: priced.updatedAt
            }
        }, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error(`[Price API] Error fetching price:`, error);

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

