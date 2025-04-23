// src/app/api/v1/metadata/[contractId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MetadataService } from '@/lib/metadata-service';
import { verifyMessageSignatureRsv } from '@stacks/encryption';
import { getAddressFromPublicKey, TransactionVersion } from '@stacks/transactions';

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

    if (!contractId) {
        return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 });
    }

    try {
        const metadata = await MetadataService.get(contractId);
        return NextResponse.json({ success: true, metadata });
    } catch (err) {
        console.error(`Error fetching metadata for ${contractId}:`, err);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch token metadata' },
            { status: 500 },
        );
    }
}

/* ───────────────────────────── POST ───────────────────────────── */
export async function POST(
    request: NextRequest,
    ctx: { params: { contractId: string } },
) {
    const { contractId } = await ctx.params;

    try {
        if (!isValidContractId(contractId)) {
            return NextResponse.json({ error: 'Invalid contract ID format' }, { status: 400 });
        }

        // ── auth headers ──
        const signature = request.headers.get('x-signature');
        const publicKey = request.headers.get('x-public-key');
        if (!signature || !publicKey) {
            return NextResponse.json({ error: 'Missing authentication headers' }, { status: 401 });
        }

        // ── verify signature ──
        const isValidSig = verifyMessageSignatureRsv({ message: contractId, publicKey, signature });
        if (!isValidSig) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // ── verify ownership ──
        const signerAddress = getAddressFromPublicKey(publicKey, TransactionVersion.Mainnet);
        if (signerAddress !== getContractAddress(contractId)) {
            return NextResponse.json(
                { error: 'Not authorized to modify this contract metadata' },
                { status: 403 },
            );
        }

        const body = await request.json();
        if (!body.name || !body.description || !body.image) {
            return NextResponse.json(
                { success: false, error: 'Name, description, and image are required fields' },
                { status: 400 },
            );
        }

        const result = await MetadataService.set(contractId, body);
        return NextResponse.json(result);
    } catch (err) {
        console.error('Failed to handle metadata:', err);
        const msg = err instanceof Error ? err.message : 'Failed to handle metadata request';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/* ───────────────────────────── DELETE ───────────────────────────── */
export async function DELETE(
    request: NextRequest,
    ctx: { params: { contractId: string } },
) {
    const { contractId } = await ctx.params;

    try {
        if (!isValidContractId(contractId)) {
            return NextResponse.json({ error: 'Invalid contract ID format' }, { status: 400 });
        }

        // ── auth headers ──
        const signature = request.headers.get('x-signature');
        const publicKey = request.headers.get('x-public-key');
        if (!signature || !publicKey) {
            return NextResponse.json({ error: 'Missing authentication headers' }, { status: 401 });
        }

        // ── verify signature ──
        const isValidSig = verifyMessageSignatureRsv({ message: contractId, publicKey, signature });
        if (!isValidSig) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // ── verify ownership ──
        const signerAddress = getAddressFromPublicKey(publicKey, TransactionVersion.Mainnet);
        if (signerAddress !== getContractAddress(contractId)) {
            return NextResponse.json(
                { error: 'Not authorized to delete this contract metadata' },
                { status: 403 },
            );
        }

        await MetadataService.delete(contractId);
        return NextResponse.json({
            success: true,
            message: `Metadata for ${contractId} has been deleted`,
        });
    } catch (err) {
        console.error('Failed to delete metadata:', err);
        const msg = err instanceof Error ? err.message : 'Failed to delete metadata';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
