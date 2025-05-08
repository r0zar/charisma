import { NextResponse } from 'next/server';
import { cancelOrder } from '@/lib/orders/store';

export async function PATCH(_req: Request, { params }: { params: { uuid: string } }) {
    const { uuid } = await params;
    const order = await cancelOrder(uuid);
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ status: 'success', data: order });
} 