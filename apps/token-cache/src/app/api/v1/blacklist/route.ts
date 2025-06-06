import { NextRequest, NextResponse } from 'next/server';
import { getBlacklistedTokenIds, addToBlacklist, removeFromBlacklist } from '@/lib/tokenService';

/**
 * Define CORS headers for API routes
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
};

/**
 * GET handler for fetching all blacklisted tokens
 * **Only works in development mode.**
 */
export async function GET(req: NextRequest) {
    // Strict check for development environment
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
            {
                success: false,
                error: 'This endpoint is only available in development mode.'
            },
            { status: 403, headers: corsHeaders }
        );
    }

    try {
        const blacklistedTokens = await getBlacklistedTokenIds();

        return NextResponse.json({
            success: true,
            data: blacklistedTokens,
            count: blacklistedTokens.length
        }, {
            status: 200,
            headers: corsHeaders
        });
    } catch (error) {
        console.error('Error fetching blacklisted tokens:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch blacklisted tokens',
                data: []
            },
            { status: 500, headers: corsHeaders }
        );
    }
}

/**
 * POST handler for adding a token to the blacklist
 * **Only works in development mode.**
 */
export async function POST(req: NextRequest) {
    // Strict check for development environment
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
            {
                success: false,
                error: 'This endpoint is only available in development mode.'
            },
            { status: 403, headers: corsHeaders }
        );
    }

    try {
        const body = await req.json();
        const { contractId } = body;

        if (!contractId || typeof contractId !== 'string') {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Contract ID is required and must be a string'
                },
                { status: 400, headers: corsHeaders }
            );
        }

        const result = await addToBlacklist(contractId);

        return NextResponse.json(result, {
            status: result.success ? 200 : 400,
            headers: corsHeaders
        });
    } catch (error) {
        console.error('Error adding token to blacklist:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to add token to blacklist'
            },
            { status: 500, headers: corsHeaders }
        );
    }
}

/**
 * DELETE handler for removing a token from the blacklist
 * **Only works in development mode.**
 */
export async function DELETE(req: NextRequest) {
    // Strict check for development environment
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
            {
                success: false,
                error: 'This endpoint is only available in development mode.'
            },
            { status: 403, headers: corsHeaders }
        );
    }

    try {
        const { searchParams } = new URL(req.url);
        const contractId = searchParams.get('contractId');

        if (!contractId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Contract ID is required as query parameter'
                },
                { status: 400, headers: corsHeaders }
            );
        }

        const result = await removeFromBlacklist(contractId);

        return NextResponse.json(result, {
            status: result.success ? 200 : 400,
            headers: corsHeaders
        });
    } catch (error) {
        console.error('Error removing token from blacklist:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to remove token from blacklist'
            },
            { status: 500, headers: corsHeaders }
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