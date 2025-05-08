export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { processOpenOrders } from '@/lib/orders/executor';

export async function GET() {
    try {
        const filled = await processOpenOrders();
        return NextResponse.json({ status: 'success', filledCount: filled.length, filled });
    } catch (err) {
        console.error('Scheduled order processing failed', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
} 