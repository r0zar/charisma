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
        const executionResult = await executeTrade(order);
        
        console.log('[Execute API] Trade execution result:', { orderUuid: order.uuid, executionResult });
        
        if (!executionResult.success || !executionResult.txid) {
            console.error('[Execute API] Trade execution failed:', { orderUuid: order.uuid, executionResult });
            return NextResponse.json({ 
                error: `Order execution failed: ${executionResult.error || 'No transaction ID returned'}` 
            }, { status: 400 });
        }
        
        // Note: fillOrder is still used here as it's the store function, different from the deprecated processor function
        await fillOrder(order.uuid, executionResult.txid);

        // Send notification (fire-and-forget style, errors handled within the function)
        sendOrderExecutedNotification(order, executionResult.txid).catch(err => {
            console.error('Failed to dispatch order execution notification:', { orderUuid: order.uuid, error: err });
        });

        return NextResponse.json({ status: 'success', txid: executionResult.txid });
    } catch (err) {
        console.error('Execute order error', err);
        return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
    }
} 