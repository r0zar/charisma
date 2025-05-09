import { type NextRequest, NextResponse } from 'next/server';
import { processOpenOrders } from '@/lib/orders/executor';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const filled = await processOpenOrders();
        return NextResponse.json({ status: 'success', filledCount: filled.length, filled });
    } catch (err) {
        console.error('Failed to process open orders', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
} 