export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { addPriceSnapshot, getLatestPrice } from '@/lib/price/store';
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
        const prices = await listPrices();

        // check if CHA token is in the processed prices
        if (prices['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token']) {
            console.log('CHA token found in processed prices');
        }

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