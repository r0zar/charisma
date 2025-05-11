export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { processPendingStripeIntents } from '@/lib/blaze-intent-server';
import { type NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
    // ----- Authorization -----
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const processedResults = await processPendingStripeIntents();
        return NextResponse.json({
            status: 'success',
            processedCount: processedResults.length,
            results: processedResults
        });
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Scheduled Stripe intent processing failed:', errorMessage, err);
        return NextResponse.json({ error: 'Internal error', details: errorMessage }, { status: 500 });
    }
} 