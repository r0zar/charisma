import { type NextRequest, NextResponse } from 'next/server';
import { getOrder, fillOrder } from '@/lib/orders/store';
import { verifySignedRequest } from '@repo/stacks';
import { executeTrade } from '@/lib/orders/executor';

const ORDERS_API_KEY = process.env.ORDERS_API_KEY || process.env.METADATA_API_KEY; // fallback

export async function POST(req: NextRequest, { params }: { params: { uuid: string } }) {
    try {
        const { uuid } = await params;

        const order = await getOrder(uuid);
        if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (order.status !== 'open') return NextResponse.json({ error: 'Order not open' }, { status: 400 });

        /* ────────────── Authorization ────────────── */
        if (ORDERS_API_KEY) {
            const apiKey = req.headers.get('x-api-key');
            if (apiKey === ORDERS_API_KEY) {
                // privileged key ok
            } else {
                const authRes = await verifySignedRequest(req, { message: uuid, expectedAddress: order.owner });
                if (!authRes.ok) {
                    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
                }
            }
        } else {
            const authRes = await verifySignedRequest(req, { message: uuid, expectedAddress: order.owner });
            if (!authRes.ok) {
                return NextResponse.json({ error: authRes.error }, { status: authRes.status });
            }
        }

        /* ────────────── Execute ────────────── */
        const txid = await executeTrade(order);
        await fillOrder(order.uuid, txid);
        return NextResponse.json({ status: 'success', txid });
    } catch (err) {
        console.error('Execute order error', err);
        return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
    }
} 