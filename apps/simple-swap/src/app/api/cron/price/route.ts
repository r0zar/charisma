export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { addPriceSnapshot } from '@/lib/price/store';
import { listPrices } from '@repo/tokens';

export async function GET() {
    const now = Date.now();
    let count = 0;

    try {
        // Fetch all token prices (USD values) from the source
        const prices = await listPrices();

        // Store each token's price individually
        for (const [contractId, price] of Object.entries(prices)) {
            // Skip tokens without a valid price
            if (typeof price !== 'number' || isNaN(price)) continue;

            // Use contractId as the key for storage
            await addPriceSnapshot(contractId, price, now);
            count++;
        }

        return NextResponse.json({ status: 'success', count, timestamp: now });
    } catch (err) {
        console.error('Price snapshot cron failed', err);
        return NextResponse.json({ error: 'Failed to snapshot prices' }, { status: 500 });
    }
} 