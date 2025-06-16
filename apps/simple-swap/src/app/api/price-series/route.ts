import { getPricesInRange } from "@/lib/price/store";
import { NextResponse } from "next/server";

// In your API endpoint
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const timeframe = searchParams.get('timeframe');

    if (!contractId) {
        return NextResponse.json(
            { error: 'Missing "contractId" query param' },
            { status: 400 },
        );
    }

    const now = Date.now();
    let from: number;

    // Convert timeframe to milliseconds
    if (timeframe) {
        const timeframeMs = parseTimeframe(timeframe);
        from = now - timeframeMs;
    } else {
        const fromParam = searchParams.get('from');
        from = fromParam ? Number(fromParam) : now - 1000 * 60 * 60 * 24 * 30;
    }

    const toParam = searchParams.get('to');
    const to = toParam ? Number(toParam) : now;

    const raw = await getPricesInRange(contractId, from, to);
    const series = raw.map(([ts, price]) => ({
        time: Math.floor(ts / 1000),
        value: price,
    }));

    return NextResponse.json(series);
}

function parseTimeframe(timeframe: string): number {
    const match = timeframe.match(/^(\d+)([hdw])$/);
    if (!match) return 4 * 24 * 60 * 60 * 1000; // default 4 days

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'w': return value * 7 * 24 * 60 * 60 * 1000;
        default: return 4 * 24 * 60 * 60 * 1000;
    }
}