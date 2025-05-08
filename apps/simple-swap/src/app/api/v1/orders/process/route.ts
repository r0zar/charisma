import { NextResponse } from 'next/server';
import { processOpenOrders } from '@/lib/orders/executor';

export async function POST() {
    try {
        const filled = await processOpenOrders();
        return NextResponse.json({ status: 'success', filledCount: filled.length, filled });
    } catch (err) {
        console.error('Failed to process open orders', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
} 