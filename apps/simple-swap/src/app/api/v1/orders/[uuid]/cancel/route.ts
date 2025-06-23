import { type NextRequest, NextResponse } from 'next/server';
import { cancelOrder, getOrder } from '@/lib/orders/store';
import { 
  authenticateOrderOperation,
  createErrorResponse
} from '@/lib/api-keys/middleware';

export async function PATCH(req: NextRequest, { params }: { params: { uuid: string } }) {
    const { uuid } = params;

    // First fetch order (needed to validate signer matches owner)
    const order = await getOrder(uuid);
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    /* ────────────────── Authorization ────────────────── */
    const authResult = await authenticateOrderOperation(
        req,
        order.owner,
        'cancel',
        uuid
    );

    if (!authResult.success) {
        const status = authResult.error?.includes('rate limit') ? 429 : 401;
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
    const cancelled = await cancelOrder(uuid);
    return NextResponse.json({ status: 'success', data: cancelled });
} 