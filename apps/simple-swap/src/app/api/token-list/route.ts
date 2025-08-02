import { listTokens } from '@/lib/contract-registry-adapter';
import { NextResponse } from 'next/server';

interface TokenOption {
    contractId: string;
    symbol: string;
    name: string;
    image?: string;
}

// GET /api/token-list
export async function GET() {
    try {
        const tokens = await listTokens();
        const out: TokenOption[] = tokens.map((t: any) => ({
            contractId: t.contractId || '',
            symbol: t.symbol || '',
            name: t.name,
            image: t.image || null,
        }));
        return NextResponse.json(out);
    } catch (error) {
        console.error('[token-list] Failed to fetch tokens during build:', error);
        // Return empty array during build failures to prevent build from failing
        return NextResponse.json([]);
    }
}

export const revalidate = 600; // cache token list for 10 minutes 