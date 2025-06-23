export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { snapshotPricesFromOracle } from '@/lib/price/store';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
    // Authorization check
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await snapshotPricesFromOracle();
        
        if (result.status === 'success') {
            return NextResponse.json({ 
                status: 'success', 
                count: result.count, 
                timestamp: result.timestamp,
                charismaTokenIncluded: result.charismaTokenIncluded 
            });
        } else {
            return NextResponse.json({ error: 'Failed to snapshot prices' }, { status: 500 });
        }
    } catch (err) {
        console.error('Price snapshot cron failed', err);
        return NextResponse.json({ error: 'Failed to snapshot prices' }, { status: 500 });
    }
} 