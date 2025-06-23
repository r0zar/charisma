import { NextRequest, NextResponse } from 'next/server';
import { getTwitterTrigger, updateTwitterTrigger } from '@/lib/twitter-triggers/store';

// POST /api/v1/twitter-triggers/[id]/add-orders - Add additional orders to a trigger
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = await params;
        const { orderIds } = await request.json();
        
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'orderIds array is required and must not be empty'
            }, { status: 400 });
        }
        
        const trigger = await getTwitterTrigger(id);
        
        if (!trigger) {
            return NextResponse.json({
                success: false,
                error: 'Twitter trigger not found'
            }, { status: 404 });
        }
        
        // Add new order IDs to existing ones
        const currentOrderIds = trigger.orderIds || [];
        const updatedOrderIds = [...currentOrderIds, ...orderIds];
        
        // Update the trigger with new order IDs and recalculate available orders
        await updateTwitterTrigger(id, {
            orderIds: updatedOrderIds,
            availableOrders: updatedOrderIds.length - trigger.triggeredCount,
            maxTriggers: updatedOrderIds.length
        });
        
        console.log(`[Twitter API] Added ${orderIds.length} additional orders to trigger ${id}`);
        
        return NextResponse.json({
            success: true,
            message: `Successfully added ${orderIds.length} additional orders to trigger`,
            data: {
                triggerId: id,
                addedOrderIds: orderIds,
                totalOrders: updatedOrderIds.length,
                availableOrders: updatedOrderIds.length - trigger.triggeredCount
            }
        });
        
    } catch (error) {
        console.error(`[Twitter API] Error adding orders to trigger ${params.id}:`, error);
        return NextResponse.json({
            success: false,
            error: 'Failed to add orders to Twitter trigger'
        }, { status: 500 });
    }
}