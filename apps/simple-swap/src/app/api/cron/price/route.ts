export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { addPriceSnapshot, getLatestPrice } from '@/lib/price/store';
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

        // Store each token's price individually in parallel
        const snapshotPromises: Promise<void>[] = [];
        for (const [contractId, price] of Object.entries(prices)) {
            let valueToStore: number | undefined = undefined;
            if (typeof price === 'number' && !isNaN(price)) {
                valueToStore = price;
            } else {
                // Try to get the latest price if current is invalid
                snapshotPromises.push(
                    getLatestPrice(contractId)
                        .then(latestPrice => {
                            if (typeof latestPrice === 'number' && !isNaN(latestPrice)) {
                                return addPriceSnapshot(contractId, latestPrice, now).then(() => { count++; });
                            }
                        })
                        .catch(err => {
                            console.error('Failed to add price snapshot (latest fallback)', err);
                        })
                );
                continue;
            }
            const p = addPriceSnapshot(contractId, valueToStore, now)
                .then(() => { count++; })
                .catch(err => {
                    console.error('Failed to add price snapshot', err);
                });
            snapshotPromises.push(p);
        }
        await Promise.all(snapshotPromises);

        return NextResponse.json({ status: 'success', count, timestamp: now });
    } catch (err) {
        console.error('Price snapshot cron failed', err);
        return NextResponse.json({ error: 'Failed to snapshot prices' }, { status: 500 });
    }
} 