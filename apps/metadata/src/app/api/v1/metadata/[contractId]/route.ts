// src/app/api/v1/metadata/[contractId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MetadataService } from '@/lib/metadata-service';
// Assuming verifySignedMessage is exported from your @charisma/stacks package
import { verifySignedRequest } from 'blaze-sdk';
import { generateCorsHeaders } from '@/lib/cors-helper';

/* ───────────────────────────── helpers ───────────────────────────── */
const isValidContractId = (contractId: string) =>
    /^S[A-Z0-9]+\.[^/]+$/.test(contractId);

const getContractAddress = (contractId: string) => contractId.split('.')[0];

/* ───────────────────────────── GET ───────────────────────────── */
export async function GET(
    req: NextRequest,
    ctx: { params: { contractId: string } },
) {
    const { contractId } = await ctx.params;
    const headers = generateCorsHeaders(req, 'GET');

    console.log(`Getting metadata for ${contractId}`);
    if (!contractId) {
        return NextResponse.json(
            { error: 'Contract ID is required' },
            { status: 400, headers }
        );
    }

    try {
        const metadata = await MetadataService.get(contractId);
        // If metadata is not found or empty, MetadataService.get might return an empty object or similar.
        // Consider if a 404 should be returned here if metadata is considered "not found" by the service.
        if (!metadata || Object.keys(metadata).length === 0 && metadata.constructor === Object) {
            return NextResponse.json(
                { error: 'Metadata not found' },
                { status: 404, headers }
            );
        }

        // Add HTTP caching headers for light caching
        headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400'); // 1hr fresh, 24hrs stale
        headers.set('CDN-Cache-Control', 'public, s-maxage=3600'); // CDN cache for 1hr

        // Add ETag for conditional requests (using lastUpdated if available)
        if (metadata.lastUpdated) {
            const etag = `"${Buffer.from(metadata.lastUpdated).toString('base64')}"`;
            headers.set('ETag', etag);

            // Check if client has fresh version
            const ifNoneMatch = req.headers.get('if-none-match');
            if (ifNoneMatch === etag) {
                return new NextResponse(null, { status: 304, headers });
            }
        }

        return NextResponse.json(metadata, { headers });
    } catch (err) {
        console.error(`Error fetching metadata for ${contractId}:`, err);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch token metadata' },
            { status: 500, headers }
        );
    }
}

// Handle preflight requests
export async function OPTIONS(req: NextRequest) {
    const headers = generateCorsHeaders(req, 'GET, POST, DELETE, OPTIONS');
    headers.set('Access-Control-Max-Age', '86400'); // 24 hours
    headers.set('Cache-Control', 'public, max-age=86400'); // Cache preflight for 24 hours
    return new NextResponse(null, { status: 204, headers });
}

/* ───────────────────────────── POST ───────────────────────────── */
export async function POST(
    request: NextRequest,
    ctx: { params: { contractId: string } },
) {
    const { contractId } = await ctx.params;
    const headers = generateCorsHeaders(request, 'POST');

    try {
        if (!isValidContractId(contractId)) {
            return NextResponse.json(
                { error: 'Invalid contract ID format' },
                { status: 400, headers }
            );
        }

        const apiKey = request.headers.get('x-api-key');
        const envApiKey = process.env.METADATA_API_KEY;
        let isAuthorizedByApiKey = false;

        if (apiKey && envApiKey && apiKey === envApiKey) {
            isAuthorizedByApiKey = true;
        }

        if (!isAuthorizedByApiKey) {
            const signature = request.headers.get('x-signature');
            const publicKey = request.headers.get('x-public-key');

            if (!signature || !publicKey) {
                return NextResponse.json(
                    { error: 'Missing authentication headers' },
                    { status: 401, headers }
                );
            }

            const authResult = await verifySignedRequest(
                request,
                {
                    message: contractId,
                    expectedAddress: getContractAddress(contractId),
                }
            );

            if (!authResult.ok) {
                return NextResponse.json(
                    { error: 'Invalid signature' },
                    { status: 401, headers }
                );
            }
        }
        // If either API key is valid or signature auth is valid, proceed.

        const body = await request.json();
        const result = await MetadataService.set(contractId, body);

        // Add cache invalidation headers for POST
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Expires', '0');

        return NextResponse.json(result, { headers });

    } catch (err) {
        console.error('Failed to handle metadata POST request:', err);
        const msg = err instanceof Error ? err.message : 'Failed to handle metadata request';
        return NextResponse.json({ error: msg }, { status: 500, headers });
    }
}

/* ───────────────────────────── DELETE ───────────────────────────── */
export async function DELETE(
    request: NextRequest,
    ctx: { params: { contractId: string } },
) {
    const { contractId } = await ctx.params;
    const headers = generateCorsHeaders(request, 'DELETE');

    try {
        if (!isValidContractId(contractId)) {
            return NextResponse.json(
                { error: 'Invalid contract ID format' },
                { status: 400, headers }
            );
        }

        const signature = request.headers.get('x-signature');
        const publicKey = request.headers.get('x-public-key');

        if (!signature || !publicKey) {
            return NextResponse.json(
                { error: 'Missing authentication headers' },
                { status: 401, headers }
            );
        }

        const authResult = await verifySignedRequest(
            request,
            {
                message: contractId,
                expectedAddress: getContractAddress(contractId),
            }
        );

        if (!authResult.ok) {
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401, headers }
            );
        }

        await MetadataService.delete(contractId);

        // Add cache invalidation headers for DELETE
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Expires', '0');

        return NextResponse.json({
            success: true,
            message: `Metadata for ${contractId} has been deleted`,
        }, { headers });

    } catch (err) {
        console.error('Failed to delete metadata:', err);
        const msg = err instanceof Error ? err.message : 'Failed to delete metadata';
        return NextResponse.json({ error: msg }, { status: 500, headers });
    }
}
