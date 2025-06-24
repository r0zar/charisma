import { NextRequest, NextResponse } from 'next/server';
import { listOrders, updateOrder } from '@/lib/orders/store';

/**
 * Debug/utility endpoint to backfill metadata for Twitter orders
 * This correlates TwitterTriggerExecution records with orders that are missing metadata
 */
export async function POST(request: NextRequest) {
    try {
        // Only allow in development environment
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
        }

        const body = await request.json();
        const { dryRun = true } = body; // Default to dry run for safety
        
        console.log(`[Backfill] Starting metadata backfill (dry run: ${dryRun})...`);
        
        // Get all Twitter orders
        const allOrders = await listOrders();
        const twitterOrders = allOrders.filter(order => order.strategyType === 'twitter');
        
        // Get all TwitterTriggerExecution records
        const { kv } = await import('@vercel/kv');
        const executionKeys = await kv.keys('twitter_execution:*');
        
        const executions = [];
        for (const key of executionKeys) {
            try {
                const execution = await kv.get(key);
                if (execution) {
                    executions.push(execution);
                }
            } catch (error) {
                console.warn(`[Backfill] Failed to fetch execution for key ${key}:`, error);
            }
        }
        
        console.log(`[Backfill] Found ${twitterOrders.length} Twitter orders and ${executions.length} executions`);
        
        // Find orders that need metadata backfilled
        const backfillCandidates = [];
        
        for (const order of twitterOrders) {
            // Skip if order already has execution metadata
            if (order.metadata?.execution) {
                continue;
            }
            
            // Find corresponding execution
            const correspondingExecution = executions.find((exec: any) => exec.orderUuid === order.uuid);
            
            if (correspondingExecution) {
                backfillCandidates.push({
                    order,
                    execution: correspondingExecution
                });
            }
        }
        
        console.log(`[Backfill] Found ${backfillCandidates.length} orders that need metadata backfill`);
        
        const results = [];
        
        for (const { order, execution } of backfillCandidates) {
            try {
                // Create execution metadata
                const executionMetadata = {
                    replierHandle: execution.replierHandle || '',
                    replierDisplayName: execution.replierDisplayName || '',
                    bnsName: execution.bnsName || '',
                    replyTweetId: execution.replyTweetId || '',
                    replyText: execution.replyText || '',
                    replyCreatedAt: execution.replyCreatedAt || '',
                    executedAt: execution.executedAt || new Date().toISOString(),
                    status: execution.status || 'unknown',
                    error: execution.error || null
                };
                
                const updatedOrder = {
                    ...order,
                    metadata: {
                        ...order.metadata,
                        execution: executionMetadata
                    }
                };
                
                if (!dryRun) {
                    await updateOrder(updatedOrder);
                    console.log(`[Backfill] ✅ Updated order ${order.uuid} with execution metadata`);
                }
                
                results.push({
                    orderUuid: order.uuid,
                    success: true,
                    action: dryRun ? 'would_update' : 'updated',
                    executionMetadata,
                    originalExecution: {
                        id: execution.id,
                        status: execution.status,
                        replierHandle: execution.replierHandle,
                        bnsName: execution.bnsName
                    }
                });
                
            } catch (error) {
                console.error(`[Backfill] ❌ Failed to update order ${order.uuid}:`, error);
                results.push({
                    orderUuid: order.uuid,
                    success: false,
                    action: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        
        const summary = {
            totalTwitterOrders: twitterOrders.length,
            totalExecutions: executions.length,
            backfillCandidates: backfillCandidates.length,
            successfulBackfills: results.filter(r => r.success).length,
            failedBackfills: results.filter(r => !r.success).length,
            dryRun
        };
        
        console.log(`[Backfill] Summary:`, summary);
        
        return NextResponse.json({
            success: true,
            summary,
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Backfill] Error in metadata backfill:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}