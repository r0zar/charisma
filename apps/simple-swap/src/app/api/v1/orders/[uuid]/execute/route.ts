import { type NextRequest, NextResponse } from 'next/server';
import { getOrder, fillOrder } from '@/lib/orders/store';
import { executeTrade } from '@/lib/orders/executor';
import { sendOrderExecutedNotification } from '@/lib/notifications/order-executed-handler';
import { 
  authenticateOrderOperation,
  createErrorResponse
} from '@/lib/api-keys/middleware';

export async function POST(req: NextRequest, { params }: { params: { uuid: string } }) {
    try {
        const { uuid } = await params;

        const order = await getOrder(uuid);
        if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (order.status !== 'open') return NextResponse.json({ error: 'Order not open' }, { status: 400 });

        /* ────────────── Authorization ────────────── */
        const authResult = await authenticateOrderOperation(
            req,
            order.owner,
            'execute',
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

        /* ────────────── Execute ────────────── */
        const txid = await executeTrade(order);
        await fillOrder(order.uuid, txid);

        // Send notification (fire-and-forget style, errors handled within the function)
        sendOrderExecutedNotification(order, txid).catch(err => {
            console.error('Failed to dispatch order execution notification:', { orderUuid: order.uuid, error: err });
        });

        return NextResponse.json({ status: 'success', txid });
    } catch (err) {
        console.error('Execute order error', err);
        return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
    }
} 