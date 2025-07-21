import { NextRequest, NextResponse } from 'next/server';
import { getAllMetadataPaginated, getTokenCount } from '@/lib/tokenService';

/**
 * Define CORS headers for API routes
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Optimized caching: 5min browser, 15min CDN, 1hr Vercel CDN (shorter due to search/pagination)
    'Cache-Control': 'public, max-age=300',
    'CDN-Cache-Control': 'public, s-maxage=900',
    'Vercel-CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
};

/**
 * GET handler for fetching paginated tokens with optional search
 */
export async function GET(req: NextRequest) {
    // Apply CORS headers
    const headers = corsHeaders;

    try {
        // Parse query parameters
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10))); // Cap at 100
        const search = searchParams.get('search')?.trim() || '';

        // Fetch paginated tokens
        const tokens = await getAllMetadataPaginated(page, limit, search);
        const totalCount = await getTokenCount(search);
        
        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / limit);
        const hasMore = page < totalPages;
        const hasPrevious = page > 1;

        // Return the paginated response
        return NextResponse.json({
            tokens,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages,
                hasMore,
                hasPrevious
            },
            search: search || null
        }, {
            status: 200,
            headers
        });
    } catch (error) {
        console.error('Error fetching paginated tokens:', error);
        return NextResponse.json(
            { 
                error: 'Failed to fetch tokens',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
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