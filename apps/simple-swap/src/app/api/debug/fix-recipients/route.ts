import { NextRequest, NextResponse } from 'next/server';
import { listOrders, updateOrder } from '@/lib/orders/store';

/**
 * Fix recipient addresses for Twitter orders by resolving BNS names
 */
export async function POST(request: NextRequest) {
    try {
        // Only allow in development environment
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
        }

        const body = await request.json();
        const { dryRun = true } = body;
        
        console.log(`[Fix Recipients] Starting recipient fix (dry run: ${dryRun})...`);
        
        // Get all Twitter orders with execution metadata
        const allOrders = await listOrders();
        const twitterOrders = allOrders.filter(order => 
            order.strategyType === 'twitter' && 
            order.metadata?.execution?.bnsName &&
            (order.status === 'confirmed' || order.status === 'broadcasted')
        );
        
        console.log(`[Fix Recipients] Found ${twitterOrders.length} Twitter orders with BNS names`);
        
        const results = [];
        
        for (const order of twitterOrders) {
            try {
                const bnsName = order.metadata.execution.bnsName;
                console.log(`[Fix Recipients] Resolving BNS: ${bnsName}`);
                
                // Resolve BNS name
                const response = await fetch(`https://stacks-node-api.mainnet.stacks.co/v1/names/${bnsName}`);
                
                if (!response.ok) {
                    console.warn(`[Fix Recipients] Failed to resolve ${bnsName}: ${response.status}`);
                    results.push({
                        orderUuid: order.uuid,
                        bnsName,
                        success: false,
                        error: `BNS resolution failed: ${response.status}`
                    });
                    continue;
                }
                
                const bnsData = await response.json();
                const resolvedAddress = bnsData.address;
                
                if (!resolvedAddress) {
                    console.warn(`[Fix Recipients] No address found for ${bnsName}`);
                    results.push({
                        orderUuid: order.uuid,
                        bnsName,
                        success: false,
                        error: 'No address in BNS response'
                    });
                    continue;
                }
                
                // Check if the recipient needs updating
                if (order.recipient === resolvedAddress) {
                    console.log(`[Fix Recipients] Order ${order.uuid} already has correct recipient`);
                    results.push({
                        orderUuid: order.uuid,
                        bnsName,
                        success: true,
                        action: 'no_change_needed',
                        currentRecipient: order.recipient,
                        resolvedAddress
                    });
                    continue;
                }
                
                console.log(`[Fix Recipients] Need to update recipient for ${order.uuid}:`);
                console.log(`[Fix Recipients]   Current: ${order.recipient}`);
                console.log(`[Fix Recipients]   Should be: ${resolvedAddress}`);
                
                if (!dryRun) {
                    // Update the order with correct recipient
                    const updatedOrder = {
                        ...order,
                        recipient: resolvedAddress
                    };
                    
                    await updateOrder(updatedOrder);
                    console.log(`[Fix Recipients] ✅ Updated order ${order.uuid} recipient`);
                }
                
                results.push({
                    orderUuid: order.uuid,
                    bnsName,
                    success: true,
                    action: dryRun ? 'would_update' : 'updated',
                    currentRecipient: order.recipient,
                    resolvedAddress,
                    replierHandle: order.metadata.execution.replierHandle
                });
                
            } catch (error) {
                console.error(`[Fix Recipients] Error processing order ${order.uuid}:`, error);
                results.push({
                    orderUuid: order.uuid,
                    bnsName: order.metadata?.execution?.bnsName || 'unknown',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        
        const summary = {
            totalTwitterOrders: twitterOrders.length,
            needsUpdate: results.filter(r => r.action === 'would_update' || r.action === 'updated').length,
            alreadyCorrect: results.filter(r => r.action === 'no_change_needed').length,
            failed: results.filter(r => !r.success).length,
            dryRun
        };
        
        console.log(`[Fix Recipients] Summary:`, summary);
        
        return NextResponse.json({
            success: true,
            summary,
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Fix Recipients] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}