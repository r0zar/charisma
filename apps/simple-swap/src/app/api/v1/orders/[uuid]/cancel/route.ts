import { type NextRequest, NextResponse } from 'next/server';
import { cancelOrder, getOrder } from '@/lib/orders/store';
import { verifySignedRequest } from '@repo/stacks';

const ORDERS_API_KEY = process.env.ORDERS_API_KEY || process.env.METADATA_API_KEY; // fallback to same var

export async function PATCH(req: NextRequest, { params }: { params: { uuid: string } }) {
    const { uuid } = params;

    // First fetch order (needed to validate signer matches owner)
    const order = await getOrder(uuid);
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    /* ────────────────── Authorization ────────────────── */
    if (ORDERS_API_KEY) {
        const apiKey = req.headers.get('x-api-key');
        if (apiKey === ORDERS_API_KEY) {
            // privileged key, skip signature validation
        } else {
            // fall through to signature validation
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

    /* ─────────────── Cancel the order ─────────────── */
    const cancelled = await cancelOrder(uuid);
    return NextResponse.json({ status: 'success', data: cancelled });
} 