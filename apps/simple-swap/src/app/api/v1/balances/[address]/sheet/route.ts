import { NextResponse } from 'next/server';
import { validateStacksAddress } from '@stacks/transactions';
import { balanceSheet } from '@/lib/balance-sheet/sheet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Balances are public on the chain, so any site may read them
const headers = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };

/**
 * GET /api/v1/balances/{address}/sheet
 * Instant balances: per token, what's settled on the chain, what's on its way, what's held for signed orders and
 * bets, and every entry behind those numbers (see src/lib/balance-sheet/types.ts).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
    const { address } = await params;
    if (!validateStacksAddress(address)) {
        return NextResponse.json({ error: 'Invalid address', message: `${address} is not a Stacks address` }, { status: 400, headers });
    }
    try {
        return NextResponse.json(await balanceSheet(address), { headers });
    } catch (error) {
        console.error(`[balance-sheet] ${address}:`, error);
        return NextResponse.json(
            { error: "Couldn't read balances", message: error instanceof Error ? error.message : String(error) },
            { status: 502, headers },
        );
    }
}
