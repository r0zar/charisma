import { NextResponse } from 'next/server';
import { listOrders } from '@/lib/orders/store';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const owner = searchParams.get('owner') || undefined;
        const orders = await listOrders(owner);
        return NextResponse.json({ status: 'success', data: orders });
    } catch (err) {
        console.error('Orders list error', err);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
} 