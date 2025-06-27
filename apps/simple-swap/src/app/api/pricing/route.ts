import { NextResponse } from 'next/server';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Cache for 1 hour on CDN, stale-while-revalidate for 2 hours
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    try {
        console.log('[Pricing API] Fetching pricing data from dex-cache');

        // Determine environment
        const isDev = process.env.NODE_ENV === 'development';

        // Use dex-cache pricing API endpoint
        const endpoint = isDev
            ? 'http://localhost:3003/api/v1/prices'
            : 'https://invest.charisma.rocks/api/v1/prices';

        const response = await fetch(endpoint, {
            // Cache the fetch request for 1 hour
            next: { revalidate: 3600 } // 1 hour in seconds
        });

        if (!response.ok) {
            console.error('[Pricing API] Dex-cache API response not ok:', response.status, response.statusText);
            throw new Error(`Dex-cache API responded with ${response.status}`);
        }

        const result = await response.json();

        if (!result.data) {
            console.error('[Pricing API] Invalid response format from dex-cache:', result);
            throw new Error('Invalid response format from dex-cache');
        }

        console.log(`[Pricing API] Successfully fetched pricing data for ${result.data.length} tokens`);

        return NextResponse.json({
            status: 'success',
            data: result.data,
            count: result.data.length,
            cached: true,
            lastUpdated: new Date().toISOString()
        }, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error('[Pricing API] Error fetching pricing data:', error);

        return NextResponse.json({
            status: 'error',
            error: 'Failed to fetch pricing data',
            message: process.env.NODE_ENV === 'development' ? error?.message : undefined
        }, {
            status: 500,
            headers
        });
    }
}