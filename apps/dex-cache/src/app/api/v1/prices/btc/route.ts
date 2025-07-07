import { NextResponse } from 'next/server';
import { getBtcPrice, getOracleHealth } from '@/lib/pricing/btc-oracle';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Extended cache for bandwidth optimization: 15min fresh, 30min stale
    'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800'
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    const startTime = Date.now();
    
    try {
        const url = new URL(request.url);
        const includeHealth = url.searchParams.get('health') === 'true';

        console.log('[BTC Price API] Fetching current BTC price...');

        // Get current BTC price
        const btcPrice = await getBtcPrice();

        if (!btcPrice) {
            // Get health info for error context
            const health = await getOracleHealth();
            
            return NextResponse.json({
                status: 'error',
                error: 'BTC price unavailable',
                message: 'Unable to fetch BTC price from any source',
                health: includeHealth ? health : undefined
            }, {
                status: 503,
                headers
            });
        }

        // Build response
        const response: any = {
            price: btcPrice.price,
            source: btcPrice.source,
            confidence: btcPrice.confidence,
            timestamp: btcPrice.timestamp,
            age: Date.now() - btcPrice.timestamp
        };

        // Include health information if requested
        if (includeHealth) {
            const health = await getOracleHealth();
            response.health = health;
        }

        const processingTime = Date.now() - startTime;
        
        console.log(`[BTC Price API] Returned BTC price $${btcPrice.price.toFixed(2)} in ${processingTime}ms`);

        return NextResponse.json({
            status: 'success',
            data: response,
            metadata: {
                processingTimeMs: processingTime,
                includeHealth
            }
        }, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error('[BTC Price API] Error fetching BTC price:', error);
        
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