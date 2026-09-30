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
 * Changing the block list needs the admin key (Authorization: Bearer <TOKEN_CACHE_ADMIN_KEY>);
 * local development is allowed without it.
 */
function isAdmin(req: NextRequest): boolean {
    if (process.env.NODE_ENV === 'development') return true;
    const key = process.env.TOKEN_CACHE_ADMIN_KEY;
    return !!key && req.headers.get('authorization') === `Bearer ${key}`;
}

const forbidden = () => NextResponse.json(
    { success: false, error: 'Admin key required (Authorization: Bearer <TOKEN_CACHE_ADMIN_KEY>)' },
    { status: 403, headers: corsHeaders }
);

/**
 * GET handler for fetching all blacklisted tokens. Public: wallets and apps use it to hide scam tokens.
 */
export async function GET() {
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
 * POST handler for adding a token to the blacklist (admin key required)
 */
export async function POST(req: NextRequest) {
    if (!isAdmin(req)) return forbidden();

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
 * DELETE handler for removing a token from the blacklist (admin key required)
 */
export async function DELETE(req: NextRequest) {
    if (!isAdmin(req)) return forbidden();

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