import { kv } from '@vercel/kv';
import { getTransactionDetails } from '@repo/polyglot';
import type { LimitOrder } from './orders/types';
import { confirmOrder, failOrder, cancelOrder } from './orders/store';
import { countOrdersByType, type OrderTypeCounts } from './orders/classification';
import { getTokenMetadataCached } from '@repo/tokens';

/**
 * Transaction status types from Stacks blockchain
 */
export type TransactionStatus = 'success' | 'abort_by_response' | 'abort_by_post_condition' | 'pending';

/**
 * Result of monitoring a single transaction
 */
export interface TransactionMonitorResult {
    txid: string;
    orderId: string;
    previousStatus: 'open' | 'broadcasted' | 'confirmed' | 'failed' | 'cancelled';
    currentStatus: TransactionStatus;
    orderUpdated: boolean;
    error?: string;
}

/**
 * Check transaction status directly on the blockchain
 */
export async function checkTransactionStatus(txid: string): Promise<{
    status: TransactionStatus;
    blockHeight?: number;
    blockTime?: number;
    txResult?: any;
}> {
    try {
        console.log(`[TX-MONITOR] Fetching transaction details for ${txid}`);

        const txDetails = await getTransactionDetails(txid);
        
        // Validate transaction details structure
        if (!txDetails || typeof txDetails !== 'object') {
            console.warn(`[TX-MONITOR] Invalid or missing transaction details for ${txid}, treating as pending:`, txDetails);
            // Return pending status instead of throwing error
            return {
                status: 'pending' as TransactionStatus,
                blockHeight: undefined,
                blockTime: undefined,
                txResult: undefined
            };
        }

        // Check if tx_status exists and is valid
        if (!txDetails.tx_status) {
            console.error(`[TX-MONITOR] Missing tx_status for transaction ${txid}:`, txDetails);
            // If transaction is missing tx_status, it's likely still pending
            return {
                status: 'pending' as TransactionStatus,
                blockHeight: txDetails.block_height,
                blockTime: txDetails.block_time,
                txResult: txDetails.tx_result
            };
        }

        const status = txDetails.tx_status as TransactionStatus;

        // Validate status is a known value
        const validStatuses = ['pending', 'success', 'abort_by_response', 'abort_by_post_condition'];
        if (!validStatuses.includes(status)) {
            console.warn(`[TX-MONITOR] Unknown transaction status '${status}' for ${txid}, treating as pending`);
            return {
                status: 'pending' as TransactionStatus,
                blockHeight: txDetails.block_height,
                blockTime: txDetails.block_time,
                txResult: txDetails.tx_result
            };
        }

        return {
            status,
            blockHeight: txDetails.block_height,
            blockTime: txDetails.block_time,
            txResult: txDetails.tx_result
        };
    } catch (error) {
        console.error(`[TX-MONITOR] Error fetching transaction details for ${txid}:`, error);
        
        // Check if this looks like a 404/not found error which suggests invalid txid
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('Not Found')) {
            console.error(`[TX-MONITOR] 🚨 Transaction ${txid} not found on blockchain - likely invalid txid`);
            // Return a special status that indicates the transaction doesn't exist
            return {
                status: 'pending' as TransactionStatus,
                blockHeight: undefined,
                blockTime: undefined,
                txResult: undefined,
                // @ts-ignore - adding custom property to indicate invalid txid
                notFound: true
            };
        }
        
        // For other errors, treat as pending but log the issue
        console.warn(`[TX-MONITOR] Treating transaction ${txid} as pending due to fetch error`);
        return {
            status: 'pending' as TransactionStatus,
            blockHeight: undefined,
            blockTime: undefined,
            txResult: undefined
        };
    }
}

/**
 * Monitor a single order's transaction and update the order directly if needed
 */
export async function monitorOrderTransaction(
    orderId: string,
    order: LimitOrder
): Promise<TransactionMonitorResult> {
    const result: TransactionMonitorResult = {
        txid: order.txid!,
        orderId,
        previousStatus: order.status,
        currentStatus: 'pending',
        orderUpdated: false
    };

    try {
        if (!order.txid) {
            // Cancel orders that have no transaction ID but are marked as broadcasted
            // This indicates bad data - the order was marked as sent but has no txid
            console.error(`[TX-MONITOR] 🚨 Order ${orderId} has status '${order.status}' but no txid - cancelling due to data corruption`);
            await cancelOrder(orderId);
            result.orderUpdated = true;
            result.error = 'Order cancelled: missing transaction ID';
            return result;
        }

        // Check current status on blockchain
        const txInfo = await checkTransactionStatus(order.txid);
        result.currentStatus = txInfo.status;
        
        // @ts-ignore - check our custom notFound property
        if (txInfo.notFound) {
            // Transaction definitely doesn't exist on blockchain - cancel immediately
            console.error(`[TX-MONITOR] 🚨 Order ${orderId} with txid ${order.txid} not found on blockchain - cancelling immediately due to invalid txid`);
            await cancelOrder(orderId);
            result.orderUpdated = true;
            result.error = 'Order cancelled: transaction not found on blockchain';
            return result;
        }
        
        // If transaction details consistently fail to load, the txid might be invalid
        // We'll check for this condition and cancel if needed
        if (txInfo.status === 'pending' && !txInfo.blockHeight && !txInfo.blockTime && !txInfo.txResult) {
            // This suggests the transaction doesn't exist or is malformed
            // Check how long the order has been in this state
            const orderAge = Date.now() - new Date(order.createdAt).getTime();
            const maxPendingTime = 24 * 60 * 60 * 1000; // 24 hours
            
            if (orderAge > maxPendingTime) {
                console.error(`[TX-MONITOR] 🚨 Order ${orderId} with txid ${order.txid} has been pending for ${Math.round(orderAge / (60 * 60 * 1000))} hours without blockchain confirmation - likely invalid txid, cancelling`);
                await cancelOrder(orderId);
                result.orderUpdated = true;
                result.error = 'Order cancelled: transaction not found on blockchain after 24 hours';
                return result;
            }
        }

        // Update order based on transaction status
        if (txInfo.status === 'abort_by_response' || txInfo.status === 'abort_by_post_condition') {
            // Transaction failed - update to 'failed' status
            await failOrder(orderId, txInfo.status);
            result.orderUpdated = true;

            console.log(`[TX-MONITOR] ❌ Order ${orderId} marked as 'failed' due to transaction failure ${order.txid} (${txInfo.status})`);
        } else if (txInfo.status === 'success') {
            // Transaction confirmed - update to 'confirmed' status
            await confirmOrder(orderId, txInfo.blockHeight, txInfo.blockTime);
            result.orderUpdated = true;

            console.log(`[TX-MONITOR] ✅ Order ${orderId} confirmed on blockchain at block ${txInfo.blockHeight}`);

            // Trigger system-wide balance refresh after successful transaction
            // Note: This refreshes balances for all users, not just the order owner
            try {
                const response = await fetch('/api/blaze/balances', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: order.owner
                    })
                });

                if (response.ok) {
                    console.log(`[TX-MONITOR] ✅ System-wide balance refresh triggered by order ${orderId} (owner: ${order.owner})`);
                } else {
                    console.warn(`[TX-MONITOR] ⚠️ Balance refresh failed for order ${orderId}: HTTP ${response.status}`);
                }
            } catch (balanceError) {
                console.error(`[TX-MONITOR] ❌ Error triggering balance refresh for order ${orderId}:`, balanceError);
            }
        } else {
            // Still pending
            console.log(`[TX-MONITOR] ⏳ Order ${orderId} transaction ${order.txid} still pending`);
        }

        return result;

    } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[TX-MONITOR] Error monitoring order ${orderId}:`, error);
        return result;
    }
}

/**
 * Get all orders that need transaction monitoring
 * (orders with status 'broadcasted' and a txid)
 */
export async function getOrdersNeedingMonitoring(): Promise<Array<{ uuid: string; order: LimitOrder }>> {
    try {
        const ordersData = await kv.hgetall('orders');
        if (!ordersData) {
            return [];
        }

        const ordersToCheck: Array<{ uuid: string; order: LimitOrder }> = [];

        for (const [uuid, orderJson] of Object.entries(ordersData)) {
            try {
                // Check if orderJson is already an object or needs parsing
                let order: LimitOrder;
                if (typeof orderJson === 'string') {
                    order = JSON.parse(orderJson) as LimitOrder;
                } else {
                    order = orderJson as LimitOrder;
                }

                // Only check orders that are marked as 'broadcasted' and have a txid
                // Also include legacy 'filled' orders for migration
                // @ts-ignore
                if ((order.status === 'broadcasted' || order.status === 'filled') && order.txid) {
                    ordersToCheck.push({ uuid, order });
                }
            } catch (parseError) {
                console.error(`[TX-MONITOR] 🚨 Failed to parse order ${uuid}:`, parseError);
                console.error(`[TX-MONITOR] Raw order data:`, orderJson);
                
                // Cancel orders with corrupted JSON data - they can't be processed
                try {
                    console.error(`[TX-MONITOR] 🚨 Cancelling order ${uuid} due to corrupted JSON data`);
                    await cancelOrder(uuid);
                } catch (cancelError) {
                    console.error(`[TX-MONITOR] Failed to cancel corrupted order ${uuid}:`, cancelError);
                    // Try to delete the corrupted entry directly from KV
                    try {
                        await kv.hdel('orders', uuid);
                        console.log(`[TX-MONITOR] ✅ Deleted corrupted order ${uuid} from storage`);
                    } catch (deleteError) {
                        console.error(`[TX-MONITOR] Failed to delete corrupted order ${uuid}:`, deleteError);
                    }
                }
            }
        }

        console.log(`[TX-MONITOR] Found ${ordersToCheck.length} orders needing monitoring`);
        return ordersToCheck;
    } catch (error) {
        console.error('[TX-MONITOR] Error getting orders for monitoring:', error);
        throw error;
    }
}

/**
 * Get transaction monitoring statistics by examining orders directly
 */
export async function getTransactionMonitoringStats(): Promise<{
    totalOrders: number;
    ordersNeedingMonitoring: number;
    pendingTransactions: number;
    confirmedTransactions: number;
    failedTransactions: number;
    orderTypes: {
        single: number;
        dca: number;
        sandwich: number;
    };
}> {
    try {
        const ordersData = await kv.hgetall('orders');
        const totalOrders = ordersData ? Object.keys(ordersData).length : 0;

        const ordersToCheck = await getOrdersNeedingMonitoring();
        const ordersNeedingMonitoring = ordersToCheck.length;

        // Count orders by their current status  
        let pendingTransactions = 0;
        let confirmedTransactions = 0;
        let failedTransactions = 0;

        // Parse all orders first
        const allOrders: LimitOrder[] = [];
        if (ordersData) {
            for (const [orderId, orderJson] of Object.entries(ordersData)) {
                try {
                    // Check if orderJson is already an object or needs parsing
                    let order: LimitOrder;
                    if (typeof orderJson === 'string') {
                        order = JSON.parse(orderJson) as LimitOrder;
                    } else {
                        order = orderJson as LimitOrder;
                    }

                    allOrders.push(order);

                    // Count transaction statuses
                    if (order.txid) {
                        switch (order.status) {
                            case 'broadcasted':
                            // @ts-ignore
                            case 'filled': // Legacy status
                                pendingTransactions++;
                                break;
                            case 'confirmed':
                                confirmedTransactions++;
                                break;
                            case 'failed':
                                failedTransactions++;
                                break;
                        }
                    }
                } catch (parseError) {
                    console.error(`[TX-MONITOR] 🚨 Failed to parse order ${orderId}:`, parseError);
                    console.error(`[TX-MONITOR] Raw order data:`, orderJson);
                    
                    // Cancel orders with corrupted JSON data - they can't be processed
                    try {
                        console.error(`[TX-MONITOR] 🚨 Cancelling order ${orderId} due to corrupted JSON data in stats`);
                        await cancelOrder(orderId);
                    } catch (cancelError) {
                        console.error(`[TX-MONITOR] Failed to cancel corrupted order ${orderId}:`, cancelError);
                        // Try to delete the corrupted entry directly from KV
                        try {
                            await kv.hdel('orders', orderId);
                            console.log(`[TX-MONITOR] ✅ Deleted corrupted order ${orderId} from storage`);
                        } catch (deleteError) {
                            console.error(`[TX-MONITOR] Failed to delete corrupted order ${orderId}:`, deleteError);
                        }
                    }
                }
            }
        }

        // Classify orders by type using the new classification utility
        const orderTypeCounts = await countOrdersByType(allOrders, getTokenMetadataCached);

        return {
            totalOrders,
            ordersNeedingMonitoring,
            pendingTransactions,
            confirmedTransactions,
            failedTransactions,
            orderTypes: {
                single: orderTypeCounts.single,
                dca: orderTypeCounts.dca,
                sandwich: orderTypeCounts.sandwich
            }
        };
    } catch (error) {
        console.error('[TX-MONITOR] Error getting monitoring stats:', error);
        throw error;
    }
}