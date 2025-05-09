import { listTokens } from '@repo/tokens';
import { NextResponse } from 'next/server';

interface TokenOption {
    contractId: string;
    symbol: string;
    name: string;
}

// GET /api/token-list
export async function GET() {
    const tokens = await listTokens();
    const out: TokenOption[] = tokens.map((t) => ({
        contractId: t.contractId,
        symbol: t.symbol,
        name: t.name,
    }));
    return NextResponse.json(out);
} 