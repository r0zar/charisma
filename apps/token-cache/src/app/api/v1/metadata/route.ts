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
    // Optimized caching: 15min browser, 1hr CDN, 6hr Vercel CDN (raw metadata changes less frequently)
    'Cache-Control': 'public, max-age=900',
    'CDN-Cache-Control': 'public, s-maxage=3600',
    'Vercel-CDN-Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=172800'
};

/**
 * GET handler for fetching all metadata
 */
export async function GET(req: NextRequest) {
    // Apply CORS headers
    const headers = corsHeaders;

    try {
        // Fetch all metadata using the existing service
        const cacheData = await getAllMetadata();

        // Return the tokens with CORS headers
        return NextResponse.json(cacheData, {
            status: 200,
            headers
        });
    } catch (error) {
        console.error('Error fetching all metadata:', error);
        return NextResponse.json(
            { error: 'Failed to fetch metadata' },
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