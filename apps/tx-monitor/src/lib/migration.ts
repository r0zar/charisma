import { kv } from '@vercel/kv';
import { addToQueue, getCachedStatus, setCachedStatus } from './transaction-monitor';
import type { TransactionInfo, TransactionStatus } from './types';

/**
 * Migration library to move transactions from old simple-swap queue to new tx-monitor service
 */

interface LegacyOrder {
    owner: string;
    inputToken: string;
    outputToken: string;
    amountIn: string;
    targetPrice?: string;
    direction?: 'lt' | 'gt';
    conditionToken?: string;
    baseAsset?: string;
    recipient: string;
    signature: string;
    uuid: string;
    status: 'open' | 'broadcasted' | 'confirmed' | 'failed' | 'cancelled' | 'filled';
    createdAt: string;
    txid?: string;
    blockHeight?: number;
    blockTime?: number;
    confirmedAt?: string;
    failedAt?: string;
    failureReason?: string;
    strategyId?: string;
    strategyType?: 'dca' | 'twitter';
    strategyPosition?: number;
    strategySize?: number;
    strategyDescription?: string;
    metadata?: Record<string, any>;
}

interface BotActivityRecord {
    userAddress: string;
    botId: string;
    txid: string;
    status: 'pending' | 'success' | 'failed';
    blockHeight?: number;
    blockTime?: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

interface MigrationResult {
    success: boolean;
    summary: {
        ordersProcessed: number;
        botActivitiesProcessed: number;
        transactionsMigrated: number;
        transactionsSkipped: number;
        errors: string[];
    };
    details: {
        migratedTransactions: string[];
        skippedTransactions: Array<{ txid: string; reason: string }>;
        errors: Array<{ txid?: string; error: string }>;
    };
}

/**
 * Map legacy order status to new transaction status
 */
function mapLegacyStatusToTransactionStatus(legacyStatus: string): TransactionStatus {
    switch (legacyStatus) {
        case 'broadcasted':
        case 'filled':
            return 'pending';
        case 'confirmed':
            return 'success';
        case 'failed':
            return 'abort_by_response'; // Default failure type
        default:
            return 'pending';
    }
}

/**
 * Extract all orders from the legacy orders hash
 */
async function extractLegacyOrders(): Promise<LegacyOrder[]> {
    try {
        const ordersData = await kv.hgetall('orders');
        if (!ordersData) {
            return [];
        }

        const orders: LegacyOrder[] = [];
        for (const [uuid, orderData] of Object.entries(ordersData)) {
            try {
                // Handle both JSON strings and objects
                let order: LegacyOrder;
                if (typeof orderData === 'string') {
                    order = JSON.parse(orderData) as LegacyOrder;
                } else {
                    order = orderData as LegacyOrder;
                }
                orders.push(order);
            } catch (parseError) {
                console.warn(`[MIGRATION] Failed to parse order ${uuid}:`, parseError);
            }
        }

        return orders;
    } catch (error) {
        console.error('[MIGRATION] Failed to extract legacy orders:', error);
        return [];
    }
}

/**
 * Extract bot activities from legacy bot activity keys
 */
async function extractBotActivities(): Promise<BotActivityRecord[]> {
    try {
        // Get all keys matching the bot activity pattern
        const keys = await kv.keys('bot_activity:*');
        if (!keys || keys.length === 0) {
            return [];
        }

        const activities: BotActivityRecord[] = [];
        for (const key of keys) {
            try {
                const activitiesData = await kv.get(key);
                if (Array.isArray(activitiesData)) {
                    activities.push(...activitiesData);
                }
            } catch (error) {
                console.warn(`[MIGRATION] Failed to extract bot activities from ${key}:`, error);
            }
        }

        return activities;
    } catch (error) {
        console.error('[MIGRATION] Failed to extract bot activities:', error);
        return [];
    }
}

/**
 * Get transactions that need to be migrated from orders
 */
function getTransactionsFromOrders(orders: LegacyOrder[]): Array<{ txid: string; order: LegacyOrder }> {
    return orders
        .filter(order => 
            order.txid && 
            (order.status === 'broadcasted' || order.status === 'filled' || order.status === 'confirmed' || order.status === 'failed')
        )
        .map(order => ({ txid: order.txid!, order }));
}

/**
 * Get transactions that need to be migrated from bot activities
 */
function getTransactionsFromBotActivities(activities: BotActivityRecord[]): Array<{ txid: string; activity: BotActivityRecord }> {
    return activities
        .filter(activity => activity.txid && activity.status === 'pending')
        .map(activity => ({ txid: activity.txid, activity }));
}

/**
 * Check if a transaction is already in the new monitoring system
 */
async function isTransactionAlreadyMigrated(txid: string): Promise<boolean> {
    try {
        // Check if transaction is in the new queue
        const isInQueue = await kv.sismember('tx:queue', txid);
        if (isInQueue) {
            return true;
        }

        // Check if transaction has cached status in new system
        const cachedStatus = await getCachedStatus(txid);
        if (cachedStatus) {
            return true;
        }

        return false;
    } catch (error) {
        console.error(`[MIGRATION] Error checking if transaction ${txid} is migrated:`, error);
        return false;
    }
}

/**
 * Create TransactionInfo from legacy order
 */
function createTransactionInfoFromOrder(order: LegacyOrder): TransactionInfo {
    const status = mapLegacyStatusToTransactionStatus(order.status);
    
    return {
        txid: order.txid!,
        status,
        blockHeight: order.blockHeight,
        blockTime: order.blockTime,
        addedAt: new Date(order.createdAt).getTime(),
        lastChecked: order.confirmedAt ? new Date(order.confirmedAt).getTime() : Date.now(),
        checkCount: 1
    };
}

/**
 * Create TransactionInfo from bot activity
 */
function createTransactionInfoFromActivity(activity: BotActivityRecord): TransactionInfo {
    const status = activity.status === 'success' ? 'success' : 
                   activity.status === 'failed' ? 'abort_by_response' : 'pending';
    
    return {
        txid: activity.txid,
        status,
        blockHeight: activity.blockHeight,
        blockTime: activity.blockTime,
        addedAt: activity.timestamp,
        lastChecked: Date.now(),
        checkCount: 1
    };
}

/**
 * Main migration function
 */
export async function migrateLegacyTransactions(dryRun: boolean = false): Promise<MigrationResult> {
    console.log(`[MIGRATION] Starting transaction migration (dry run: ${dryRun})`);
    
    const result: MigrationResult = {
        success: false,
        summary: {
            ordersProcessed: 0,
            botActivitiesProcessed: 0,
            transactionsMigrated: 0,
            transactionsSkipped: 0,
            errors: []
        },
        details: {
            migratedTransactions: [],
            skippedTransactions: [],
            errors: []
        }
    };

    try {
        // Step 1: Extract legacy data
        console.log('[MIGRATION] Extracting legacy orders...');
        const legacyOrders = await extractLegacyOrders();
        result.summary.ordersProcessed = legacyOrders.length;
        
        console.log('[MIGRATION] Extracting bot activities...');
        const botActivities = await extractBotActivities();
        result.summary.botActivitiesProcessed = botActivities.length;

        // Step 2: Get transactions to migrate
        const orderTransactions = getTransactionsFromOrders(legacyOrders);
        const botTransactions = getTransactionsFromBotActivities(botActivities);
        
        console.log(`[MIGRATION] Found ${orderTransactions.length} order transactions and ${botTransactions.length} bot activity transactions`);

        // Step 3: Process order transactions
        for (const { txid, order } of orderTransactions) {
            try {
                // Check if already migrated
                if (await isTransactionAlreadyMigrated(txid)) {
                    result.summary.transactionsSkipped++;
                    result.details.skippedTransactions.push({ txid, reason: 'Already migrated' });
                    continue;
                }

                if (!dryRun) {
                    // Create transaction info
                    const transactionInfo = createTransactionInfoFromOrder(order);
                    
                    // If transaction is pending, add to queue
                    if (transactionInfo.status === 'pending') {
                        await addToQueue([txid]);
                    }
                    
                    // Cache the status
                    await setCachedStatus(txid, transactionInfo);
                }

                result.summary.transactionsMigrated++;
                result.details.migratedTransactions.push(txid);
                
                console.log(`[MIGRATION] Migrated order transaction ${txid} with status ${order.status}`);
                
            } catch (error) {
                const errorMsg = `Failed to migrate order transaction ${txid}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                result.summary.errors.push(errorMsg);
                result.details.errors.push({ txid, error: errorMsg });
                console.error(`[MIGRATION] ${errorMsg}`);
            }
        }

        // Step 4: Process bot activity transactions
        for (const { txid, activity } of botTransactions) {
            try {
                // Check if already migrated
                if (await isTransactionAlreadyMigrated(txid)) {
                    result.summary.transactionsSkipped++;
                    result.details.skippedTransactions.push({ txid, reason: 'Already migrated' });
                    continue;
                }

                if (!dryRun) {
                    // Create transaction info
                    const transactionInfo = createTransactionInfoFromActivity(activity);
                    
                    // If transaction is pending, add to queue
                    if (transactionInfo.status === 'pending') {
                        await addToQueue([txid]);
                    }
                    
                    // Cache the status
                    await setCachedStatus(txid, transactionInfo);
                }

                result.summary.transactionsMigrated++;
                result.details.migratedTransactions.push(txid);
                
                console.log(`[MIGRATION] Migrated bot activity transaction ${txid} with status ${activity.status}`);
                
            } catch (error) {
                const errorMsg = `Failed to migrate bot activity transaction ${txid}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                result.summary.errors.push(errorMsg);
                result.details.errors.push({ txid, error: errorMsg });
                console.error(`[MIGRATION] ${errorMsg}`);
            }
        }

        result.success = result.summary.errors.length === 0;
        
        console.log(`[MIGRATION] Migration completed. Success: ${result.success}`);
        console.log(`[MIGRATION] Summary: ${result.summary.transactionsMigrated} migrated, ${result.summary.transactionsSkipped} skipped, ${result.summary.errors.length} errors`);
        
        return result;
        
    } catch (error) {
        const errorMsg = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.summary.errors.push(errorMsg);
        result.details.errors.push({ error: errorMsg });
        console.error(`[MIGRATION] ${errorMsg}`);
        
        return result;
    }
}

/**
 * Cleanup migrated transactions from legacy system (use with caution!)
 */
export async function cleanupMigratedTransactions(transactionIds: string[], dryRun: boolean = true): Promise<void> {
    if (dryRun) {
        console.log(`[MIGRATION] DRY RUN: Would cleanup ${transactionIds.length} migrated transactions from legacy system`);
        return;
    }

    console.log(`[MIGRATION] Cleaning up ${transactionIds.length} migrated transactions from legacy system`);
    
    // Note: This is intentionally conservative - we're not automatically cleaning up
    // the legacy system to avoid data loss. Manual cleanup should be done after
    // verifying the migration was successful.
    
    console.log('[MIGRATION] Cleanup should be done manually after verifying migration success');
}