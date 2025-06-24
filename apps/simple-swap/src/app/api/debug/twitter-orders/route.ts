import { NextRequest, NextResponse } from 'next/server';
import { listOrders } from '@/lib/orders/store';

/**
 * Debug endpoint to check Twitter strategy orders and their metadata
 */
export async function GET(request: NextRequest) {
    try {
        // Only allow in development environment
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
        }

        console.log('[Debug] Fetching all orders to check Twitter metadata...');
        
        // Get all orders
        const allOrders = await listOrders();
        
        // Filter for Twitter strategy orders
        const twitterOrders = allOrders.filter(order => order.strategyType === 'twitter');
        
        console.log(`[Debug] Found ${twitterOrders.length} Twitter strategy orders out of ${allOrders.length} total orders`);
        
        // Analyze metadata for each Twitter order
        const analysis = twitterOrders.map(order => ({
            uuid: order.uuid,
            status: order.status,
            createdAt: order.createdAt,
            strategyId: order.strategyId,
            recipient: order.recipient,
            hasMetadata: !!order.metadata,
            hasExecutionMetadata: !!(order.metadata?.execution),
            executionMetadata: order.metadata?.execution || null,
            fullMetadata: order.metadata || null
        }));
        
        // Summary statistics
        const summary = {
            totalTwitterOrders: twitterOrders.length,
            ordersWithMetadata: analysis.filter(a => a.hasMetadata).length,
            ordersWithExecutionMetadata: analysis.filter(a => a.hasExecutionMetadata).length,
            confirmedOrders: analysis.filter(a => a.status === 'confirmed').length,
            broadcastedOrders: analysis.filter(a => a.status === 'broadcasted').length,
            openOrders: analysis.filter(a => a.status === 'open').length
        };
        
        console.log('[Debug] Twitter orders analysis:', summary);
        
        return NextResponse.json({
            success: true,
            summary,
            orders: analysis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Debug] Error analyzing Twitter orders:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}