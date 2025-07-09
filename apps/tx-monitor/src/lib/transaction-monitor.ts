import { kv } from '@vercel/kv';
import { getTransactionDetails } from '@repo/polyglot';
import type { TransactionStatus, TransactionInfo, QueueAddRequest, QueueAddResponse, StatusResponse, QueueStatsResponse, MetricsSnapshot, MetricsHistoryResponse } from './types';

const QUEUE_KEY = 'tx:queue';
const STATUS_KEY_PREFIX = 'tx:status:';
const ADDED_KEY_PREFIX = 'tx:added:';
const METRICS_KEY_PREFIX = 'tx:metrics:';
const LAST_CRON_KEY = 'tx:last-cron';
const MAX_PENDING_TIME = 24 * 60 * 60 * 1000; // 24 hours
const REAL_TIME_TIMEOUT = 30000; // 30 seconds

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
            console.warn(`[TX-MONITOR] Invalid or missing transaction details for ${txid}:`, txDetails);
            return {
                status: 'not_found' as TransactionStatus,
                blockHeight: undefined,
                blockTime: undefined,
                txResult: undefined
            };
        }

        // Check if tx_status exists and is valid
        if (!txDetails.tx_status) {
            console.warn(`[TX-MONITOR] Missing tx_status for transaction ${txid}:`, txDetails);
            return {
                status: 'pending' as TransactionStatus,
                blockHeight: txDetails.block_height,
                blockTime: txDetails.block_time,
                txResult: txDetails.tx_result
            };
        }

        const status = txDetails.tx_status as TransactionStatus;

        // Validate status is a known value
        const validStatuses = ['pending', 'success', 'abort_by_response', 'abort_by_post_condition', 'broadcasted'];
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
            console.error(`[TX-MONITOR] Transaction ${txid} not found on blockchain - likely invalid txid`);
            throw new Error(`Transaction ${txid} not found on blockchain`);
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
 * Add one or more transaction IDs to the monitoring queue
 */
export async function addToQueue(txids: string[]): Promise<QueueAddResponse> {
    const added: string[] = [];
    const alreadyMonitored: string[] = [];
    
    for (const txid of txids) {
        // Check if already in queue
        const isQueued = await kv.sismember(QUEUE_KEY, txid);
        if (isQueued) {
            alreadyMonitored.push(txid);
            continue;
        }
        
        // Add to queue
        await kv.sadd(QUEUE_KEY, txid);
        
        // Store when it was added
        await kv.set(`${ADDED_KEY_PREFIX}${txid}`, Date.now());
        
        added.push(txid);
    }
    
    return {
        success: true,
        added,
        alreadyMonitored
    };
}

/**
 * Get all transactions currently in the monitoring queue
 */
export async function getQueuedTransactions(): Promise<string[]> {
    const txids = await kv.smembers(QUEUE_KEY);
    return txids || [];
}

/**
 * Remove transactions from the queue
 */
export async function removeFromQueue(txids: string[]): Promise<void> {
    if (txids.length === 0) return;
    
    await kv.srem(QUEUE_KEY, ...txids);
    
    // Clean up related keys
    for (const txid of txids) {
        await kv.del(`${ADDED_KEY_PREFIX}${txid}`);
        await kv.del(`${STATUS_KEY_PREFIX}${txid}`);
    }
}

/**
 * Clean up transactions that have been pending for more than 24 hours
 */
export async function cleanupOldTransactions(): Promise<string[]> {
    const txids = await getQueuedTransactions();
    const toRemove: string[] = [];
    const now = Date.now();
    
    for (const txid of txids) {
        const addedAt = await kv.get(`${ADDED_KEY_PREFIX}${txid}`);
        if (typeof addedAt === 'number' && now - addedAt > MAX_PENDING_TIME) {
            toRemove.push(txid);
        }
    }
    
    if (toRemove.length > 0) {
        await removeFromQueue(toRemove);
        console.log(`[TX-MONITOR] Cleaned up ${toRemove.length} old transactions:`, toRemove);
    }
    
    return toRemove;
}

/**
 * Get cached transaction status
 */
export async function getCachedStatus(txid: string): Promise<TransactionInfo | null> {
    const cached = await kv.get(`${STATUS_KEY_PREFIX}${txid}`);
    if (cached && typeof cached === 'object') {
        return cached as TransactionInfo;
    }
    return null;
}

/**
 * Cache transaction status with different TTL based on status
 */
export async function setCachedStatus(txid: string, info: TransactionInfo): Promise<void> {
    // Set different cache times based on transaction status
    let ttl: number;
    
    if (info.status === 'success' || info.status === 'abort_by_response' || info.status === 'abort_by_post_condition') {
        // Confirmed/failed transactions are immutable - cache for 24 hours
        ttl = 24 * 60 * 60; // 24 hours
    } else if (info.status === 'not_found') {
        // Not found transactions - very short cache in case they get broadcasted
        ttl = 10; // 10 seconds
    } else {
        // Pending transactions change frequently - cache for 5 minutes
        ttl = 5 * 60; // 5 minutes
    }
    
    await kv.set(`${STATUS_KEY_PREFIX}${txid}`, info, { ex: ttl });
}

/**
 * Real-time transaction status check with timeout
 */
export async function realTimeCheck(txid: string): Promise<StatusResponse> {
    // Check if already cached
    const cached = await getCachedStatus(txid);
    if (cached) {
        return {
            txid,
            status: cached.status,
            blockHeight: cached.blockHeight,
            blockTime: cached.blockTime,
            fromCache: true,
            checkedAt: cached.lastChecked
        };
    }
    
    // Try to get status with timeout
    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = 6; // 6 attempts over 30 seconds
    
    while (Date.now() - startTime < REAL_TIME_TIMEOUT && attempts < maxAttempts) {
        attempts++;
        
        try {
            const result = await checkTransactionStatus(txid);
            
            // If confirmed or failed, return immediately
            if (result.status === 'success' || result.status === 'abort_by_response' || result.status === 'abort_by_post_condition') {
                const info: TransactionInfo = {
                    txid,
                    status: result.status,
                    blockHeight: result.blockHeight,
                    blockTime: result.blockTime,
                    addedAt: Date.now(),
                    lastChecked: Date.now(),
                    checkCount: attempts
                };
                
                await setCachedStatus(txid, info);
                
                return {
                    txid,
                    status: result.status,
                    blockHeight: result.blockHeight,
                    blockTime: result.blockTime,
                    fromCache: false,
                    checkedAt: Date.now()
                };
            }
            
            // If not found or still pending, continue trying (might not be broadcasted yet)
            if (result.status === 'not_found' || result.status === 'pending') {
                console.log(`[TX-MONITOR] Transaction ${txid} ${result.status === 'not_found' ? 'not found' : 'still pending'}, attempt ${attempts}/${maxAttempts}`);
                
                // Wait before next check if we haven't reached max attempts and still have time
                if (attempts < maxAttempts && Date.now() - startTime < REAL_TIME_TIMEOUT - 5000) {
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                }
            }
            
        } catch (error) {
            console.error(`[TX-MONITOR] Error in real-time check for ${txid}:`, error);
            
            // If it's a not found error, propagate it
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('not found on blockchain')) {
                throw error;
            }
            
            break;
        }
    }
    
    // Timeout reached - check if we should treat this as not found or add to queue
    try {
        const finalResult = await checkTransactionStatus(txid);
        
        if (finalResult.status === 'not_found') {
            // After 30 seconds of trying, assume transaction was never broadcasted
            console.log(`[TX-MONITOR] Transaction ${txid} not found after ${attempts} attempts over 30 seconds - likely not broadcasted`);
            throw new Error(`Transaction ${txid} not found on blockchain`);
        }
        
        // Still pending, add to queue for monitoring
        await addToQueue([txid]);
        
        return {
            txid,
            status: 'pending',
            fromCache: false,
            checkedAt: Date.now()
        };
    } catch (error) {
        // If it's a not found error, propagate it
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('not found on blockchain')) {
            throw error;
        }
        
        // For other errors, add to queue for monitoring
        await addToQueue([txid]);
        
        return {
            txid,
            status: 'pending',
            fromCache: false,
            checkedAt: Date.now()
        };
    }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueStatsResponse> {
    const txids = await getQueuedTransactions();
    const now = Date.now();
    
    let oldestTransaction: string | undefined;
    let oldestTransactionAge: number | undefined;
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalSuccessful = 0;
    
    // Find oldest transaction
    for (const txid of txids) {
        const addedAt = await kv.get(`${ADDED_KEY_PREFIX}${txid}`);
        if (typeof addedAt === 'number') {
            const age = now - addedAt;
            if (!oldestTransactionAge || age > oldestTransactionAge) {
                oldestTransaction = txid;
                oldestTransactionAge = age;
            }
        }
        
        // Count statuses
        const cached = await getCachedStatus(txid);
        if (cached) {
            totalProcessed++;
            if (cached.status === 'success') {
                totalSuccessful++;
            } else if (cached.status === 'abort_by_response' || cached.status === 'abort_by_post_condition') {
                totalFailed++;
            }
        }
    }
    
    // Determine health
    let processingHealth: 'healthy' | 'warning' | 'error' = 'healthy';
    if (totalProcessed > 0) {
        const failureRate = totalFailed / totalProcessed;
        if (failureRate > 0.2) {
            processingHealth = 'error';
        } else if (failureRate > 0.1 || (oldestTransactionAge && oldestTransactionAge > 12 * 60 * 60 * 1000)) {
            processingHealth = 'warning';
        }
    }
    
    return {
        queueSize: txids.length,
        oldestTransaction,
        oldestTransactionAge,
        processingHealth,
        totalProcessed,
        totalFailed,
        totalSuccessful
    };
}

/**
 * Store metrics snapshot for historical tracking
 */
export async function storeMetricsSnapshot(): Promise<void> {
    try {
        const stats = await getQueueStats();
        const now = Date.now();
        const hourKey = Math.floor(now / (60 * 60 * 1000)); // Hour-based key
        
        const snapshot: MetricsSnapshot = {
            timestamp: now,
            queueSize: stats.queueSize,
            processed: stats.totalProcessed,
            successful: stats.totalSuccessful,
            failed: stats.totalFailed,
            oldestTransactionAge: stats.oldestTransactionAge,
            processingHealth: stats.processingHealth
        };
        
        await kv.set(`${METRICS_KEY_PREFIX}${hourKey}`, snapshot, { ex: 7 * 24 * 60 * 60 }); // Keep for 7 days
        console.log(`[TX-MONITOR] Stored metrics snapshot for hour ${hourKey}`);
        
    } catch (error) {
        console.error('[TX-MONITOR] Error storing metrics snapshot:', error);
    }
}

/**
 * Get historical metrics for the last N hours
 */
export async function getMetricsHistory(hours: number = 24): Promise<MetricsHistoryResponse> {
    try {
        const now = Date.now();
        const currentHour = Math.floor(now / (60 * 60 * 1000));
        const metrics: MetricsSnapshot[] = [];
        
        // Get metrics for the last N hours
        for (let i = 0; i < hours; i++) {
            const hourKey = currentHour - i;
            const snapshot = await kv.get(`${METRICS_KEY_PREFIX}${hourKey}`);
            
            if (snapshot && typeof snapshot === 'object') {
                metrics.unshift(snapshot as MetricsSnapshot);
            } else {
                // Fill missing hours with empty data
                metrics.unshift({
                    timestamp: hourKey * 60 * 60 * 1000,
                    queueSize: 0,
                    processed: 0,
                    successful: 0,
                    failed: 0,
                    processingHealth: 'healthy'
                });
            }
        }
        
        return {
            metrics,
            period: `${hours}h`,
            total: metrics.length
        };
        
    } catch (error) {
        console.error('[TX-MONITOR] Error getting metrics history:', error);
        return {
            metrics: [],
            period: `${hours}h`,
            total: 0
        };
    }
}

/**
 * Update last cron run timestamp
 */
export async function updateLastCronRun(): Promise<void> {
    try {
        await kv.set(LAST_CRON_KEY, Date.now(), { ex: 24 * 60 * 60 }); // Keep for 24 hours
    } catch (error) {
        console.error('[TX-MONITOR] Error updating last cron run:', error);
    }
}

/**
 * Get last cron run timestamp
 */
export async function getLastCronRun(): Promise<number | null> {
    try {
        const lastRun = await kv.get(LAST_CRON_KEY);
        return typeof lastRun === 'number' ? lastRun : null;
    } catch (error) {
        console.error('[TX-MONITOR] Error getting last cron run:', error);
        return null;
    }
}