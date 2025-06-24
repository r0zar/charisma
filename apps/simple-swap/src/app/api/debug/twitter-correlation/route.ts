import { NextRequest, NextResponse } from 'next/server';
import { listOrders } from '@/lib/orders/store';

/**
 * Debug endpoint to check correlation between TwitterTriggerExecutions and order metadata
 */
export async function GET(request: NextRequest) {
    try {
        console.log('[Debug] Starting Twitter execution-order correlation analysis...');
        
        // Get all orders
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
                console.warn(`[Debug] Failed to fetch execution for key ${key}:`, error);
            }
        }
        
        console.log(`[Debug] Found ${twitterOrders.length} Twitter orders and ${executions.length} executions`);
        
        // Create correlation analysis
        const correlations = [];
        const orphanedExecutions = [];
        const ordersWithoutExecutions = [];
        
        // Check each execution to see if it has a corresponding order with metadata
        for (const execution of executions as any[]) {
            if (execution.orderUuid) {
                const correspondingOrder = twitterOrders.find(order => order.uuid === execution.orderUuid);
                
                if (correspondingOrder) {
                    correlations.push({
                        executionId: execution.id,
                        orderUuid: execution.orderUuid,
                        executionStatus: execution.status,
                        orderStatus: correspondingOrder.status,
                        hasExecutionMetadata: !!(correspondingOrder.metadata?.execution),
                        replierHandle: execution.replierHandle,
                        bnsName: execution.bnsName,
                        executedAt: execution.executedAt,
                        orderCreatedAt: correspondingOrder.createdAt,
                        orderMetadata: correspondingOrder.metadata?.execution || null,
                        executionData: {
                            replierHandle: execution.replierHandle,
                            replierDisplayName: execution.replierDisplayName,
                            bnsName: execution.bnsName,
                            status: execution.status,
                            executedAt: execution.executedAt
                        }
                    });
                } else {
                    orphanedExecutions.push({
                        executionId: execution.id,
                        orderUuid: execution.orderUuid,
                        reason: 'Order not found in database'
                    });
                }
            } else {
                orphanedExecutions.push({
                    executionId: execution.id,
                    orderUuid: null,
                    reason: 'No orderUuid in execution record'
                });
            }
        }
        
        // Check for Twitter orders that don't have corresponding executions
        for (const order of twitterOrders) {
            const hasExecution = executions.some((exec: any) => exec.orderUuid === order.uuid);
            if (!hasExecution && (order.status === 'confirmed' || order.status === 'broadcasted')) {
                ordersWithoutExecutions.push({
                    orderUuid: order.uuid,
                    status: order.status,
                    createdAt: order.createdAt,
                    hasMetadata: !!order.metadata,
                    hasExecutionMetadata: !!(order.metadata?.execution)
                });
            }
        }
        
        // Summary statistics
        const summary = {
            totalTwitterOrders: twitterOrders.length,
            totalExecutions: executions.length,
            successfulCorrelations: correlations.length,
            correlationsWithMetadata: correlations.filter(c => c.hasExecutionMetadata).length,
            orphanedExecutions: orphanedExecutions.length,
            ordersWithoutExecutions: ordersWithoutExecutions.length,
            metadataSuccessRate: correlations.length > 0 
                ? Math.round((correlations.filter(c => c.hasExecutionMetadata).length / correlations.length) * 100) 
                : 0
        };
        
        console.log('[Debug] Correlation analysis summary:', summary);
        
        return NextResponse.json({
            success: true,
            summary,
            correlations,
            orphanedExecutions,
            ordersWithoutExecutions,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Debug] Error in correlation analysis:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}