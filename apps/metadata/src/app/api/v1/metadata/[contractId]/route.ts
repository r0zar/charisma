// src/app/api/v1/metadata/[contractId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MetadataService } from '@/lib/metadata-service';
import { verifyMessageSignatureRsv } from '@stacks/encryption';
import { getAddressFromPublicKey, TransactionVersion } from '@stacks/transactions';
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

        // ── API Key auth ──
        const apiKey = request.headers.get('x-api-key');
        const envApiKey = process.env.METADATA_API_KEY;

        let isAuthorized = false;

        if (apiKey && envApiKey && apiKey === envApiKey) {
            isAuthorized = true;
        } else {
            // ── Signature auth (existing logic) ──
            const signature = request.headers.get('x-signature');
            const publicKey = request.headers.get('x-public-key');

            if (!signature || !publicKey) {
                return NextResponse.json(
                    { error: 'Missing authentication headers' },
                    { status: 401, headers }
                );
            }

            const isValidSig = verifyMessageSignatureRsv({ message: contractId, publicKey, signature });
            if (!isValidSig) {
                return NextResponse.json(
                    { error: 'Invalid signature' },
                    { status: 401, headers }
                );
            }

            const signerAddress = getAddressFromPublicKey(publicKey, TransactionVersion.Mainnet);
            if (signerAddress !== getContractAddress(contractId) && signerAddress !== 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS') {
                return NextResponse.json(
                    { error: 'Not authorized to modify this contract metadata' },
                    { status: 403, headers },
                );
            }
            isAuthorized = true;
        }

        if (!isAuthorized) {
            // This case should ideally be caught by one of the auth methods,
            // but as a fallback:
            return NextResponse.json(
                { error: 'Authentication failed' },
                { status: 401, headers }
            );
        }

        const body = await request.json();

        const result = await MetadataService.set(contractId, body);
        return NextResponse.json(result, { headers });
    } catch (err) {
        console.error('Failed to handle metadata:', err);
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

        // ── auth headers ──
        const signature = request.headers.get('x-signature');
        const publicKey = request.headers.get('x-public-key');
        if (!signature || !publicKey) {
            return NextResponse.json(
                { error: 'Missing authentication headers' },
                { status: 401, headers }
            );
        }

        // ── verify signature ──
        const isValidSig = verifyMessageSignatureRsv({ message: contractId, publicKey, signature });
        if (!isValidSig) {
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401, headers }
            );
        }

        // ── verify ownership ──
        const signerAddress = getAddressFromPublicKey(publicKey, TransactionVersion.Mainnet);
        if (signerAddress !== getContractAddress(contractId)) {
            return NextResponse.json(
                { error: 'Not authorized to delete this contract metadata' },
                { status: 403, headers },
            );
        }

        await MetadataService.delete(contractId);
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
