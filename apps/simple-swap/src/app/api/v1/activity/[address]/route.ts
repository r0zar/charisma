import { NextResponse } from 'next/server';
import { validateStacksAddress } from '@stacks/transactions';
import { chainActivity } from '@/lib/activity/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The chain is public, so any site may read it
const headers = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };

/**
 * GET /api/v1/activity/{address}?offset=0
 * A wallet's mined transactions from any app, newest first, each as what it changed for the wallet
 * (see src/lib/activity/chain-types.ts). `next` is the offset of the following page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
    const { address } = await params;
    if (!validateStacksAddress(address)) {
        return NextResponse.json({ error: 'Invalid address', message: `${address} is not a Stacks address` }, { status: 400, headers });
    }
    const offset = Number(new URL(request.url).searchParams.get('offset') ?? '0');
    if (!Number.isInteger(offset) || offset < 0) {
        return NextResponse.json({ error: 'Invalid offset', message: 'offset must be a whole number, 0 or more' }, { status: 400, headers });
    }
    try {
        return NextResponse.json(await chainActivity(address, offset), { headers });
    } catch (error) {
        console.error(`[activity] ${address}:`, error);
        return NextResponse.json(
            { error: "Couldn't read activity", message: error instanceof Error ? error.message : String(error) },
            { status: 502, headers },
        );
    }
}
