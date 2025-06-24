import { TwitterTriggerExecution } from './types';
import { updateTwitterExecution } from './store';

/**
 * Enhanced execution with resolved status information
 */
export interface EnhancedTwitterExecution extends TwitterTriggerExecution {
    resolvedStatus: 'pending' | 'bns_resolved' | 'order_broadcasted' | 'order_confirmed' | 'failed' | 'overflow';
    blockHeight?: number;
    blockTime?: number;
    confirmedAt?: string;
    statusSource: 'cached' | 'order_store' | 'blockchain_direct';
}

/**
 * Resolve the current status of a Twitter execution with intelligent fallback
 * 
 * Priority:
 * 1. If execution already has order_confirmed/failed status, return as-is (cached)
 * 2. Try to get status from order store (transaction monitor keeps this updated)
 * 3. Fallback to direct blockchain check if needed
 * 4. Update execution record with resolved status
 */
export async function resolveExecutionStatus(execution: TwitterTriggerExecution): Promise<EnhancedTwitterExecution> {
    const enhanced: EnhancedTwitterExecution = {
        ...execution,
        resolvedStatus: execution.status,
        statusSource: 'cached'
    };

    // If execution is already in a final state, return as-is
    if (execution.status === 'order_confirmed' || execution.status === 'failed' || execution.status === 'overflow') {
        console.log(`[Status Resolver] Execution ${execution.id} already in final state: ${execution.status}`);
        return enhanced;
    }

    // If execution doesn't have an order UUID, can't resolve further
    if (!execution.orderUuid) {
        console.log(`[Status Resolver] Execution ${execution.id} has no orderUuid, keeping status: ${execution.status}`);
        return enhanced;
    }

    try {
        // Priority 1: Check order store (maintained by transaction monitor)
        const orderStatus = await checkOrderStoreStatus(execution.orderUuid);
        
        if (orderStatus) {
            console.log(`[Status Resolver] Found order store status for ${execution.orderUuid}: ${orderStatus.status}`);
            
            // Convert order status to execution status
            let newExecutionStatus: TwitterTriggerExecution['status'];
            
            if (orderStatus.status === 'confirmed') {
                newExecutionStatus = 'order_confirmed';
                enhanced.blockHeight = orderStatus.blockHeight;
                enhanced.blockTime = orderStatus.blockTime;
                enhanced.confirmedAt = new Date().toISOString();
            } else if (orderStatus.status === 'failed') {
                newExecutionStatus = 'failed';
            } else if (orderStatus.status === 'broadcasted') {
                newExecutionStatus = 'order_broadcasted';
            } else {
                // Open, cancelled, etc. - keep current status
                return enhanced;
            }
            
            // Update execution if status changed
            if (newExecutionStatus !== execution.status) {
                console.log(`[Status Resolver] Updating execution ${execution.id}: ${execution.status} → ${newExecutionStatus} (from order store)`);
                
                const updateData: any = { status: newExecutionStatus };
                
                // Add confirmation metadata
                if (newExecutionStatus === 'order_confirmed' && enhanced.blockHeight && enhanced.blockTime) {
                    updateData.metadata = {
                        ...execution.metadata,
                        confirmation: {
                            blockHeight: enhanced.blockHeight,
                            blockTime: enhanced.blockTime,
                            confirmedAt: enhanced.confirmedAt
                        }
                    };
                }
                
                await updateTwitterExecution(execution.id, updateData);
                enhanced.resolvedStatus = newExecutionStatus;
                enhanced.statusSource = 'order_store';
            }
            
            return enhanced;
        }

        // Priority 2: Fallback to direct blockchain check
        if (execution.txid) {
            console.log(`[Status Resolver] Order not found in store, checking blockchain directly for txid: ${execution.txid}`);
            
            const blockchainStatus = await checkBlockchainStatus(execution.txid);
            
            if (blockchainStatus) {
                let newExecutionStatus: TwitterTriggerExecution['status'];
                
                if (blockchainStatus.status === 'success') {
                    newExecutionStatus = 'order_confirmed';
                    enhanced.blockHeight = blockchainStatus.blockHeight;
                    enhanced.blockTime = blockchainStatus.blockTime;
                    enhanced.confirmedAt = new Date().toISOString();
                } else if (blockchainStatus.status === 'abort_by_response' || blockchainStatus.status === 'abort_by_post_condition') {
                    newExecutionStatus = 'failed';
                } else {
                    // Still pending
                    newExecutionStatus = 'order_broadcasted';
                }
                
                // Update execution if status changed
                if (newExecutionStatus !== execution.status) {
                    console.log(`[Status Resolver] Updating execution ${execution.id}: ${execution.status} → ${newExecutionStatus} (from blockchain)`);
                    
                    const updateData: any = { status: newExecutionStatus };
                    
                    // Add confirmation metadata
                    if (newExecutionStatus === 'order_confirmed' && enhanced.blockHeight && enhanced.blockTime) {
                        updateData.metadata = {
                            ...execution.metadata,
                            confirmation: {
                                blockHeight: enhanced.blockHeight,
                                blockTime: enhanced.blockTime,
                                confirmedAt: enhanced.confirmedAt
                            }
                        };
                    }
                    
                    await updateTwitterExecution(execution.id, updateData);
                    enhanced.resolvedStatus = newExecutionStatus;
                    enhanced.statusSource = 'blockchain_direct';
                }
                
                return enhanced;
            }
        }

        // Couldn't resolve status, return original
        console.log(`[Status Resolver] Could not resolve status for execution ${execution.id}, keeping original: ${execution.status}`);
        return enhanced;

    } catch (error) {
        console.error(`[Status Resolver] Error resolving status for execution ${execution.id}:`, error);
        return enhanced;
    }
}

/**
 * Check order status from the order store (maintained by transaction monitor)
 */
async function checkOrderStoreStatus(orderUuid: string): Promise<{
    status: 'open' | 'broadcasted' | 'confirmed' | 'failed' | 'cancelled';
    blockHeight?: number;
    blockTime?: number;
} | null> {
    try {
        const { getOrder } = await import('../orders/store');
        const order = await getOrder(orderUuid);
        
        if (!order) {
            return null;
        }
        
        return {
            status: order.status,
            blockHeight: order.blockHeight,
            blockTime: order.blockTime
        };
        
    } catch (error) {
        console.error(`[Status Resolver] Error checking order store for ${orderUuid}:`, error);
        return null;
    }
}

/**
 * Check transaction status directly on blockchain
 */
async function checkBlockchainStatus(txid: string): Promise<{
    status: 'success' | 'abort_by_response' | 'abort_by_post_condition' | 'pending';
    blockHeight?: number;
    blockTime?: number;
} | null> {
    try {
        const { checkTransactionStatus } = await import('../transaction-monitor');
        const result = await checkTransactionStatus(txid);
        
        return {
            status: result.status,
            blockHeight: result.blockHeight,
            blockTime: result.blockTime
        };
        
    } catch (error) {
        console.error(`[Status Resolver] Error checking blockchain for ${txid}:`, error);
        return null;
    }
}

/**
 * Batch resolve statuses for multiple executions efficiently
 */
export async function resolveMultipleExecutionStatuses(executions: TwitterTriggerExecution[]): Promise<EnhancedTwitterExecution[]> {
    console.log(`[Status Resolver] Batch resolving ${executions.length} execution statuses`);
    
    const promises = executions.map(execution => resolveExecutionStatus(execution));
    const results = await Promise.all(promises);
    
    const statusCounts = results.reduce((acc, result) => {
        acc[result.statusSource] = (acc[result.statusSource] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    console.log(`[Status Resolver] Batch resolution complete:`, statusCounts);
    
    return results;
}