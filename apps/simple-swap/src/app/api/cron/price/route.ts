export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { addPriceSnapshot, getLatestPrice, addPriceSnapshotsBulk } from '@/lib/price/store';
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
        const tokens = await listTokens();
        const prices: Record<string, number | undefined> = { ...oraclePrices };
        for (const token of tokens) {
            if (!(token.contractId in prices)) {
                prices[token.contractId] = undefined;
            }
        }

        const snapshots: { contractId: string, price: number, timestamp: number }[] = [];
        for (const [contractId, price] of Object.entries(prices)) {
            let valueToStore: number | undefined = undefined;
            if (typeof price === 'number' && !isNaN(price)) {
                valueToStore = price;
            } else {
                const latestPrice = await getLatestPrice(contractId);
                if (typeof latestPrice === 'number' && !isNaN(latestPrice)) {
                    valueToStore = latestPrice;
                }
            }
            if (typeof valueToStore === 'number' && !isNaN(valueToStore)) {
                snapshots.push({ contractId, price: valueToStore, timestamp: now });
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