export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { addPriceSnapshot } from '@/lib/price/store';

/**
 * Provide a simple way to fetch price for a given token pair.
 * In production you should replace this with a real oracle or DEX query.
 */
async function fetchPrice(pair: string): Promise<number> {
    // Example: call your price oracle endpoint here.
    // For now we return a random price between 0.9 and 1.1 to simulate.
    const base = 1;
    const variance = Math.random() * 0.2 - 0.1; // ±10%
    return base + variance;
}

export async function GET() {
    const pairs = (process.env.PRICE_PAIRS ?? 'tokenA-tokenB').split(',').map((p) => p.trim()).filter(Boolean);
    const now = Date.now();

    try {
        for (const pair of pairs) {
            const price = await fetchPrice(pair);
            await addPriceSnapshot(pair, price, now);
        }
        return NextResponse.json({ status: 'success', pairs, timestamp: now });
    } catch (err) {
        console.error('Price snapshot cron failed', err);
        return NextResponse.json({ error: 'Failed to snapshot prices' }, { status: 500 });
    }
} 