import { NextRequest, NextResponse } from 'next/server';
import { getBlacklistedVaultIds, addVaultToBlacklist, removeVaultFromBlacklist } from '@/lib/pool-service';

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
 * GET handler for fetching all blacklisted vaults
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
        const blacklistedVaults = await getBlacklistedVaultIds();

        return NextResponse.json({
            success: true,
            data: blacklistedVaults,
            count: blacklistedVaults.length
        }, {
            status: 200,
            headers: corsHeaders
        });
    } catch (error) {
        console.error('Error fetching blacklisted vaults:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch blacklisted vaults',
                data: []
            },
            { status: 500, headers: corsHeaders }
        );
    }
}

/**
 * POST handler for adding a vault to the blacklist
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

        const result = await addVaultToBlacklist(contractId);

        return NextResponse.json(result, {
            status: result.success ? 200 : 400,
            headers: corsHeaders
        });
    } catch (error) {
        console.error('Error adding vault to blacklist:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to add vault to blacklist'
            },
            { status: 500, headers: corsHeaders }
        );
    }
}

/**
 * DELETE handler for removing a vault from the blacklist
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

        const result = await removeVaultFromBlacklist(contractId);

        return NextResponse.json(result, {
            status: result.success ? 200 : 400,
            headers: corsHeaders
        });
    } catch (error) {
        console.error('Error removing vault from blacklist:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to remove vault from blacklist'
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