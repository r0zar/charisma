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
    // Cache for 5 minutes on CDN, stale-while-revalidate for 1 day
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400'
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

        // Filter out tokens that don't have a contractId
        const tokens = cacheData
            .filter(token => token.symbol && token.image && token.decimals && token.contractId);

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