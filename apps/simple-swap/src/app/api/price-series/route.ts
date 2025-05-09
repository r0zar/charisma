import { getPricesInRange } from '@/lib/price/store';
import { NextResponse } from 'next/server';

// GET /api/price-series?contractId=...&from=...&to=...
// Returns an array of { time: number, value: number } objects compatible with Lightweight Charts.
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    if (!contractId) {
        return NextResponse.json(
            { error: 'Missing "contractId" query param' },
            { status: 400 },
        );
    }

    const now = Date.now();
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const from = fromParam ? Number(fromParam) : now - 1000 * 60 * 60 * 24 * 7; // default 7 days
    const to = toParam ? Number(toParam) : now;

    const raw = await getPricesInRange(contractId, from, to);
    // Convert to Lightweight Charts format (time in seconds)
    const series = raw.map(([ts, price]) => ({
        time: Math.floor(ts / 1000),
        value: price,
    }));

    return NextResponse.json(series);
} 