import { NextRequest, NextResponse } from 'next/server';
import { getAllTokenData } from '@/lib/tokenService';

/**
 * Define CORS headers for API routes
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET handler for fetching all tokens
 */
export async function GET(req: NextRequest) {
    // Apply CORS headers
    const headers = corsHeaders;

    try {
        // Fetch all tokens using the existing service
        const tokens = await getAllTokenData();

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