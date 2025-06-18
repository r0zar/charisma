export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { addPriceSnapshotsBulk } from '@/lib/price/store';
import { listPrices } from '@repo/tokens';
import { listTokens } from 'dexterity-sdk';

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
        const oraclePrices = await listPrices();
        const dexTokens = await listTokens();

        // filter out tokens that are not in the dexTokens list
        const oraclePricesFiltered = Object.fromEntries(
            Object.entries(oraclePrices).filter(([contractId]) =>
                dexTokens.some(token => token.contractId === contractId)
            )
        );

        console.log(`[DEBUG] oraclePricesFiltered:`, oraclePricesFiltered);

        const snapshots: { contractId: string, price: number, timestamp: number }[] = [];
        for (const [contractId, price] of Object.entries(oraclePricesFiltered)) {
            if (typeof price === 'number' && !isNaN(price)) {
                // Add tiny random noise to price (0.000001% of value)
                const noise = price * 0.00000001 * (Math.random() - 0.5); // ±0.0000005%
                const noisyPrice = price + noise;
                snapshots.push({ contractId, price: noisyPrice, timestamp: now });
            }
        }
        await addPriceSnapshotsBulk(snapshots);
        count = snapshots.length;

        return NextResponse.json({ status: 'success', count, timestamp: now });
    } catch (err) {
        console.error('Price snapshot cron failed', err);
        return NextResponse.json({ error: 'Failed to snapshot prices' }, { status: 500 });
    }
} 