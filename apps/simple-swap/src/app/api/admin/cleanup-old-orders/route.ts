import { NextRequest, NextResponse } from 'next/server';
import { getOrdersNeedingMonitoring } from '@/lib/transaction-monitor';
import { cancelOrder } from '@/lib/orders/store';

/**
 * Admin endpoint to manually clean up old broadcasted orders
 * POST /api/admin/cleanup-old-orders
 */
export async function POST(request: NextRequest) {
    try {
        console.log('[CLEANUP-OLD-ORDERS] Starting manual cleanup of old orders...');

        const body = await request.json().catch(() => ({}));
        const maxAgeHours = body.maxAgeHours || 24; // Default to 24 hours
        
        const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
        const now = Date.now();

        // Get all orders that need monitoring
        const ordersToCheck = await getOrdersNeedingMonitoring();
        
        if (ordersToCheck.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No orders need monitoring',
                cleaned: 0,
                checked: 0
            });
        }

        console.log(`[CLEANUP-OLD-ORDERS] Found ${ordersToCheck.length} orders to check`);
        
        const oldOrders = [];
        const errors = [];

        // Find orders older than the specified age
        for (const { uuid, order } of ordersToCheck) {
            const orderAge = now - new Date(order.createdAt).getTime();
            if (orderAge > maxAge) {
                const ageHours = Math.round(orderAge / (60 * 60 * 1000));
                console.log(`[CLEANUP-OLD-ORDERS] Found old order ${uuid} (${ageHours} hours old)`);
                
                oldOrders.push({
                    uuid,
                    order,
                    ageHours,
                    createdAt: order.createdAt,
                    txid: order.txid
                });
            }
        }

        if (oldOrders.length === 0) {
            return NextResponse.json({
                success: true,
                message: `No orders older than ${maxAgeHours} hours found`,
                cleaned: 0,
                checked: ordersToCheck.length,
                maxAgeHours
            });
        }

        console.log(`[CLEANUP-OLD-ORDERS] Found ${oldOrders.length} orders to clean up`);
        
        let cleaned = 0;
        
        // Cancel old orders
        for (const { uuid, ageHours } of oldOrders) {
            try {
                await cancelOrder(uuid);
                cleaned++;
                console.log(`[CLEANUP-OLD-ORDERS] ✅ Cancelled order ${uuid} (${ageHours} hours old)`);
            } catch (error) {
                console.error(`[CLEANUP-OLD-ORDERS] ❌ Error cancelling order ${uuid}:`, error);
                errors.push(`Error cancelling order ${uuid}: ${error}`);
            }
        }

        const result = {
            success: true,
            message: `Cleanup completed: ${cleaned} orders cancelled`,
            cleaned,
            checked: ordersToCheck.length,
            oldOrdersFound: oldOrders.length,
            maxAgeHours,
            errors: errors.length > 0 ? errors : undefined,
            cleanedOrders: oldOrders.slice(0, 10).map(o => ({
                uuid: o.uuid,
                ageHours: o.ageHours,
                createdAt: o.createdAt,
                txid: o.txid
            }))
        };

        console.log(`[CLEANUP-OLD-ORDERS] Cleanup completed:`, {
            cleaned,
            checked: ordersToCheck.length,
            oldOrdersFound: oldOrders.length,
            errors: errors.length
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('[CLEANUP-OLD-ORDERS] Error during cleanup:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Cleanup failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}