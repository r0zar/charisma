import { NextResponse } from 'next/server';
import { toPublicOrder } from '@/lib/orders/public';
import { findOrder } from '@/lib/orders/store';

export async function GET(_req: Request, { params }: { params: { uuid: string } }) {
    const { uuid } = await params;
    const order = await findOrder(uuid); // a uuid or its public handle
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ status: 'success', data: toPublicOrder(order) });
}