import { ApiKeyErrorCode } from '@/lib/api-keys/types';
import { type NextRequest, NextResponse } from 'next/server';
import { toPublicOrder } from '@/lib/orders/public';
import { cancelOrder, findOrder } from '@/lib/orders/store';
import {
    authenticateOrderOperation,
    createErrorResponse
} from '@/lib/api-keys/middleware';

export async function PATCH(req: NextRequest, { params }: { params: { uuid: string } }) {
    const { uuid } = await params;

    // First fetch order (needed to validate signer matches owner)
    const order = await findOrder(uuid); // a uuid or its public handle; the owner signs whichever they sent
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    /* ────────────────── Authorization ────────────────── */
    const authResult = await authenticateOrderOperation(
        req,
        order.owner,
        'cancel',
        uuid
    );

    if (!authResult.success) {
        const status = authResult.error === ApiKeyErrorCode.RATE_LIMIT_EXCEEDED ? 429 : 401;
        const response = createErrorResponse(authResult.error!, status);

        // Add rate limit headers if available
        if (authResult.rateLimitHeaders) {
            Object.entries(authResult.rateLimitHeaders).forEach(([key, value]) => {
                response.headers.set(key, value);
            });
        }

        return response;
    }

    /* ─────────────── Cancel the order ─────────────── */
    // A broadcast swap is already on its way to the chain; marking it cancelled would only hide it
    if (order.status === 'broadcasted') {
        return NextResponse.json({ error: `Order already broadcast (txid ${order.txid}); it can no longer be cancelled` }, { status: 409 });
    }
    const cancelled = await cancelOrder(order.uuid);
    return NextResponse.json({ status: 'success', data: cancelled && toPublicOrder(cancelled) });
} 