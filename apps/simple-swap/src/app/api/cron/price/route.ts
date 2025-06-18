export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { addPriceSnapshot } from '@/lib/price/store';
import { listPrices } from '@repo/tokens';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
    // Authorization check
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    let count = 0;

    try {
        // Fetch all token prices (USD values) from the source
        const prices1 = await listPrices();
        const prices2 = await listPrices();
        const prices3 = await listPrices();

        // merge the prices
        const prices = { ...prices1, ...prices2, ...prices3 };

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