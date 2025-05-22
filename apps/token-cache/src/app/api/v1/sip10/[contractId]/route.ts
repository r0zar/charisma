import { NextResponse } from 'next/server';
import { getTokenData, addContractIdToManagedList } from "@/lib/tokenService";
import { kv } from "@vercel/kv";
import { getCacheKey } from "@/lib/tokenService";

/**
 * API headers with proper CORS configuration and cache control
 */
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Cache for 5 minutes on CDN, stale-while-revalidate for 1 day
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400'
};

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

/**
 * GET endpoint to fetch token data by contract ID
 * 
 * @route GET /api/v1/sip10/:contractId
 * @param {Object} context - Request context with params
 * @param {Object} context.params - URL parameters
 * @param {string} context.params.contractId - The token contract ID to lookup
 * @returns {NextResponse} JSON response with token data or error
 */
export async function GET(
    request: Request,
    context: { params: { contractId: string } }
) {
    const { contractId } = await context.params;

    // Validate contract ID format (basic check)
    if (!contractId) {
        return NextResponse.json(
            { error: 'Contract ID is required', status: 'error' },
            { status: 400, headers }
        );
    }

    // Simple format validation
    if (!contractId.includes('.')) {
        return NextResponse.json(
            { error: 'Invalid contract ID format, expected format: [address].[contract-name]', status: 'error' },
            { status: 400, headers }
        );
    }

    const cacheKey = getCacheKey(contractId);
    let isCacheHit = false;

    try {
        // Check cache before calling getTokenData
        const cached = await kv.get(cacheKey);
        if (cached) {
            isCacheHit = true;
            kv.incr('stats:api:hits').catch(console.error); // Fire and forget increment
        } else {
            kv.incr('stats:api:misses').catch(console.error); // Fire and forget increment
        }

        // Attempt to fetch token data
        const tokenData = await getTokenData(contractId);

        if (!tokenData) {
            return NextResponse.json(
                { error: 'Token not found', status: 'error' },
                { status: 404, headers }
            );
        }

        // Attempt to add to the managed list
        await addContractIdToManagedList(contractId);

        // Successful response with token data
        return NextResponse.json({
            status: 'success',
            data: tokenData
        }, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error(`API Error fetching token ${contractId}:`, error);

        // Handle specific error types if needed
        if (error.message?.includes('rate limit')) {
            return NextResponse.json(
                { error: 'Rate limit exceeded, please try again later', status: 'error' },
                { status: 429, headers: { ...headers, 'Retry-After': '60' } }
            );
        }

        // Generic server error
        return NextResponse.json(
            { error: 'Internal Server Error', status: 'error', message: process.env.NODE_ENV === 'development' ? error.message : undefined },
            { status: 500, headers }
        );
    }
} 