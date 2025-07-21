import { NextRequest, NextResponse } from 'next/server';
import { getAllMetadata } from '@/lib/tokenService';

/**
 * Define CORS headers for API routes
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Optimized caching: 10min browser, 1hr CDN, 6hr Vercel CDN
    'Cache-Control': 'public, max-age=600',
    'CDN-Cache-Control': 'public, s-maxage=3600',
    'Vercel-CDN-Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400'
};

/**
 * GET handler for fetching all tokens
 */
export async function GET(req: NextRequest) {
    // Apply CORS headers
    const headers = corsHeaders;

    try {
        // Fetch all tokens using the existing service
        const cacheData = await getAllMetadata();

        // Filter out tokens that don't have essential fields (relaxed image requirement)
        const tokens = cacheData
            .filter(token => {
                const hasEssentials = token.contractId && token.symbol && (token.decimals !== undefined);
                if (!hasEssentials && process.env.NODE_ENV === 'development') {
                    console.debug(`[API] Filtering out token due to missing essentials:`, {
                        contractId: token.contractId,
                        symbol: token.symbol,
                        decimals: token.decimals,
                        hasImage: !!token.image
                    });
                }
                return hasEssentials;
            });

        // Return the tokens with CORS headers
        return NextResponse.json(tokens, {
            status: 200,
            headers
        });
    } catch (error) {
        console.error('Error fetching all tokens:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tokens' },
            { status: 500, headers }
        );
    }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
} 