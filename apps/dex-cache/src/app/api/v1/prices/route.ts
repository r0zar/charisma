import { NextResponse } from 'next/server';
import { fetchPrices, toInvestPrice } from '@/lib/prices-api';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // SWR: Fresh for 5min, stale-but-valid for 15 minutes, background revalidation
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900'
};


export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    const startTime = Date.now();

    try {
        const url = new URL(request.url);
        const token = url.searchParams.get('token');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const minPrice = parseFloat(url.searchParams.get('minPrice') || '0');

        const prices = await fetchPrices(token ? [token] : undefined);
        const picked = prices.tokens.filter(t => t.usd >= minPrice).slice(0, limit);
        const processingTime = Date.now() - startTime;

        const transformedData = {
            status: 'success',
            data: picked.map(toInvestPrice),
            metadata: {
                count: picked.length,
                totalTokensAvailable: prices.tokens.length,
                processingTimeMs: processingTime,
                source: 'prices.charisma.rocks',
                lastUpdated: prices.updatedAt,
                queryParams: { token, limit, minPrice }
            }
        };

        console.log(`[Prices API] Retrieved ${picked.length} prices in ${processingTime}ms`);

        return NextResponse.json(transformedData, { status: 200, headers });

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

