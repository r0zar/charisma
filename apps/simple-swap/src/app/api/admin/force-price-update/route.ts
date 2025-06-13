export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { addPriceSnapshot } from '@/lib/price/store';
import { listPrices } from '@repo/tokens';

export async function POST() {
    const now = Date.now();
    let count = 0;

    try {
        console.log('🔄 Force price update triggered by admin');

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

        console.log(`✅ Force price update completed: ${count} tokens updated`);

        return NextResponse.json({
            status: 'success',
            count,
            timestamp: now,
            message: `Successfully updated ${count} token prices`
        });
    } catch (err) {
        console.error('❌ Force price update failed:', err);
        return NextResponse.json({
            error: 'Failed to update prices',
            details: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 });
    }
} 