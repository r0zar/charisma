import { getLatestPrice } from '@/lib/price/store';
import { NextResponse } from 'next/server';

// GET /api/price-latest?contractId=...
// Returns the latest historical price for a token
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    if (!contractId) {
        return NextResponse.json(
            { error: 'Missing "contractId" query param' },
            { status: 400 },
        );
    }

    try {
        const price = await getLatestPrice(contractId);
        return NextResponse.json({ price: price || null });
    } catch (error) {
        console.error('Failed to get latest price:', error);
        return NextResponse.json(
            { error: 'Failed to fetch latest price' },
            { status: 500 },
        );
    }
}

// Cache for 60 seconds since this is fallback data
export const revalidate = 60; 