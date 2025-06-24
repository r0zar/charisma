import { kv } from '@vercel/kv';
import { TwitterTrigger, TwitterTriggerExecution, TwitterTriggerWithStats } from './types';

// KV key prefixes
const TRIGGER_PREFIX = 'twitter_trigger:';
const EXECUTION_PREFIX = 'twitter_execution:';
const TRIGGER_LIST_KEY = 'twitter_triggers:all';
const EXECUTION_LIST_KEY = 'twitter_executions:all';

/**
 * Create a new Twitter trigger
 */
export async function createTwitterTrigger(trigger: Omit<TwitterTrigger, 'id' | 'createdAt' | 'triggeredCount'>): Promise<TwitterTrigger> {
    const id = `twitter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTrigger: TwitterTrigger = {
        ...trigger,
        id,
        createdAt: new Date().toISOString(),
        triggeredCount: 0,
    };

    // Store the trigger
    await kv.set(`${TRIGGER_PREFIX}${id}`, newTrigger);

    // Add to list of all triggers
    const existingTriggers = await kv.smembers(TRIGGER_LIST_KEY) || [];
    await kv.sadd(TRIGGER_LIST_KEY, id);

    console.log(`[Twitter Store] Created trigger ${id} for tweet ${trigger.tweetId}`);
    return newTrigger;
}

/**
 * Get a Twitter trigger by ID
 */
export async function getTwitterTrigger(id: string): Promise<TwitterTrigger | null> {
    const trigger = await kv.get(`${TRIGGER_PREFIX}${id}`);
    return trigger as TwitterTrigger | null;
}

/**
 * Get all Twitter triggers with order status updates
 */
export async function listTwitterTriggers(activeOnly: boolean = false): Promise<TwitterTrigger[]> {
    const triggerIds = await kv.smembers(TRIGGER_LIST_KEY) || [];

    if (triggerIds.length === 0) {
        return [];
    }

    // Batch get all triggers
    const triggers = await Promise.all(
        triggerIds.map(id => kv.get(`${TRIGGER_PREFIX}${id}`))
    ) as TwitterTrigger[];

    // Filter out null values and optionally inactive triggers
    const validTriggers = triggers.filter(trigger =>
        trigger && (!activeOnly || trigger.isActive)
    );

    // Update available orders for triggers that have pre-signed orders
    const triggersWithUpdatedCounts = [];
    for (const trigger of validTriggers) {
        if (trigger.orderIds && trigger.orderIds.length > 0) {
            const availableOrders = await checkAvailableOrders(trigger.orderIds);

            console.log(`[Twitter Store] Trigger ${trigger.id} has ${availableOrders} available orders`);

            // Update cached count if needed
            if (trigger.availableOrders !== availableOrders) {
                await updateTwitterTrigger(trigger.id, { availableOrders });
                triggersWithUpdatedCounts.push({ ...trigger, availableOrders });
            } else {
                triggersWithUpdatedCounts.push(trigger);
            }
        } else {
            triggersWithUpdatedCounts.push(trigger);
        }
    }

    console.log(`[Twitter Store] Triggers with updated counts:`, triggersWithUpdatedCounts);

    return triggersWithUpdatedCounts;
}

/**
 * Update a Twitter trigger
 */
export async function updateTwitterTrigger(id: string, updates: Partial<TwitterTrigger>): Promise<TwitterTrigger | null> {
    const existing = await getTwitterTrigger(id);
    if (!existing) {
        return null;
    }

    const updated: TwitterTrigger = { ...existing, ...updates };
    await kv.set(`${TRIGGER_PREFIX}${id}`, updated);

    console.log(`[Twitter Store] Updated trigger ${id}`);
    return updated;
}

/**
 * Delete a Twitter trigger
 */
export async function deleteTwitterTrigger(id: string): Promise<boolean> {
    const existing = await getTwitterTrigger(id);
    if (!existing) {
        return false;
    }

    // Remove from storage
    await kv.del(`${TRIGGER_PREFIX}${id}`);

    // Remove from list
    await kv.srem(TRIGGER_LIST_KEY, id);

    console.log(`[Twitter Store] Deleted trigger ${id}`);
    return true;
}

/**
 * Increment trigger count
 */
export async function incrementTriggerCount(id: string): Promise<boolean> {
    const trigger = await getTwitterTrigger(id);
    if (!trigger) {
        return false;
    }

    const updated = await updateTwitterTrigger(id, {
        triggeredCount: trigger.triggeredCount + 1,
        lastChecked: new Date().toISOString(),
    });

    return !!updated;
}

/**
 * Create a new Twitter trigger execution record
 */
export async function createTwitterExecution(execution: Omit<TwitterTriggerExecution, 'id'>): Promise<TwitterTriggerExecution> {
    const id = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newExecution: TwitterTriggerExecution = {
        ...execution,
        id,
    };

    // Store the execution
    await kv.set(`${EXECUTION_PREFIX}${id}`, newExecution);

    // Add to list of all executions
    await kv.sadd(EXECUTION_LIST_KEY, id);

    console.log(`[Twitter Store] Created execution ${id} for trigger ${execution.triggerId}`);
    return newExecution;
}

/**
 * Update a Twitter execution record
 */
export async function updateTwitterExecution(id: string, updates: Partial<TwitterTriggerExecution>): Promise<TwitterTriggerExecution | null> {
    const existing = await kv.get(`${EXECUTION_PREFIX}${id}`);
    if (!existing) {
        return null;
    }

    const updated: TwitterTriggerExecution = { ...existing as TwitterTriggerExecution, ...updates };
    await kv.set(`${EXECUTION_PREFIX}${id}`, updated);

    console.log(`[Twitter Store] Updated execution ${id}`);
    return updated;
}

/**
 * Get executions for a specific trigger
 */
export async function getTwitterExecutions(triggerId: string, limit: number = 50): Promise<TwitterTriggerExecution[]> {
    const allExecutionIds = await kv.smembers(EXECUTION_LIST_KEY) || [];

    if (allExecutionIds.length === 0) {
        return [];
    }

    // Batch get all executions
    const pipeline = kv.pipeline();
    for (const id of allExecutionIds) {
        pipeline.get(`${EXECUTION_PREFIX}${id}`);
    }
    const executions = await pipeline.exec() as TwitterTriggerExecution[];

    // Filter by triggerId and sort by executedAt (newest first)
    const filtered = executions
        .filter(exec => exec && exec.triggerId === triggerId)
        .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
        .slice(0, limit);

    return filtered;
}

/**
 * Get executions for a specific trigger with resolved statuses
 */
export async function getTwitterExecutionsWithResolvedStatus(triggerId: string, limit: number = 50): Promise<TwitterTriggerExecution[]> {
    // Get base executions
    const executions = await getTwitterExecutions(triggerId, limit);

    if (executions.length === 0) {
        return [];
    }

    try {
        // Use status resolver to get current statuses
        const { resolveMultipleExecutionStatuses } = await import('./status-resolver');
        const resolvedExecutions = await resolveMultipleExecutionStatuses(executions);

        // Return the resolved executions (status resolver updates the records automatically)
        return resolvedExecutions.map(resolved => ({
            ...resolved,
            // Use the resolved status as the main status
            status: resolved.resolvedStatus
        }));

    } catch (error) {
        console.error('[Twitter Store] Error resolving execution statuses, returning base executions:', error);
        return executions;
    }
}

/**
 * Get existing execution for a specific trigger and BNS name (for idempotent processing)
 */
export async function getExecutionByTriggerAndBNS(triggerId: string, bnsName: string): Promise<TwitterTriggerExecution | null> {
    const allExecutionIds = await kv.smembers(EXECUTION_LIST_KEY) || [];

    if (allExecutionIds.length === 0) {
        return null;
    }

    // Batch get all executions
    const pipeline = kv.pipeline();
    for (const id of allExecutionIds) {
        pipeline.get(`${EXECUTION_PREFIX}${id}`);
    }
    const executions = await pipeline.exec() as TwitterTriggerExecution[];

    // Find execution matching both triggerId and bnsName
    const matchingExecution = executions.find(exec =>
        exec &&
        exec.triggerId === triggerId &&
        exec.bnsName === bnsName
    );

    return matchingExecution || null;
}

/**
 * Get existing execution for a specific order UUID (for transaction monitoring integration)
 */
export async function getExecutionByOrderUuid(orderUuid: string): Promise<TwitterTriggerExecution | null> {
    const allExecutionIds = await kv.smembers(EXECUTION_LIST_KEY) || [];

    if (allExecutionIds.length === 0) {
        return null;
    }

    // Batch get all executions
    const pipeline = kv.pipeline();
    for (const id of allExecutionIds) {
        pipeline.get(`${EXECUTION_PREFIX}${id}`);
    }
    const executions = await pipeline.exec() as TwitterTriggerExecution[];

    // Find execution matching the orderUuid
    const matchingExecution = executions.find(exec =>
        exec &&
        exec.orderUuid === orderUuid
    );

    return matchingExecution || null;
}

/**
 * Get all executions (for admin dashboard)
 */
export async function listAllTwitterExecutions(limit: number = 100): Promise<TwitterTriggerExecution[]> {
    const allExecutionIds = await kv.smembers(EXECUTION_LIST_KEY) || [];

    if (allExecutionIds.length === 0) {
        return [];
    }

    // Batch get all executions
    const pipeline = kv.pipeline();
    for (const id of allExecutionIds.slice(0, limit)) {
        pipeline.get(`${EXECUTION_PREFIX}${id}`);
    }
    const executions = await pipeline.exec() as TwitterTriggerExecution[];

    // Sort by executedAt (newest first)
    const sorted = executions
        .filter(exec => exec)
        .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());

    return sorted;
}

/**
 * Get all executions with resolved statuses (for admin dashboard)
 */
export async function listAllTwitterExecutionsWithResolvedStatus(limit: number = 100): Promise<TwitterTriggerExecution[]> {
    // Get base executions
    const executions = await listAllTwitterExecutions(limit);

    if (executions.length === 0) {
        return [];
    }

    try {
        // Use status resolver to get current statuses
        const { resolveMultipleExecutionStatuses } = await import('./status-resolver');
        const resolvedExecutions = await resolveMultipleExecutionStatuses(executions);

        // Return the resolved executions (status resolver updates the records automatically)
        return resolvedExecutions.map(resolved => ({
            ...resolved,
            // Use the resolved status as the main status
            status: resolved.resolvedStatus
        }));

    } catch (error) {
        console.error('[Twitter Store] Error resolving all execution statuses, returning base executions:', error);
        return executions;
    }
}

/**
 * Get trigger with execution statistics and order status
 */
export async function getTwitterTriggerWithStats(id: string): Promise<TwitterTriggerWithStats | null> {
    const trigger = await getTwitterTrigger(id);
    if (!trigger) {
        return null;
    }

    const recentExecutions = await getTwitterExecutions(id, 10);
    const totalExecutions = trigger.triggeredCount;

    // Update available orders count by checking order status
    let availableOrders = 0;
    if (trigger.orderIds && trigger.orderIds.length > 0) {
        availableOrders = await checkAvailableOrders(trigger.orderIds);

        // Update the cached count if it's different
        if (trigger.availableOrders !== availableOrders) {
            await updateTwitterTrigger(id, { availableOrders });
        }
    }

    return {
        ...trigger,
        availableOrders,
        recentExecutions,
        totalExecutions,
    };
}

/**
 * Check how many pre-signed orders are still available (not executed)
 */
export async function checkAvailableOrders(orderIds: string[]): Promise<number> {
    if (!orderIds || orderIds.length === 0) {
        return 0;
    }

    try {
        // Import order checking function
        const { getOrder } = await import('../orders/store');

        let availableCount = 0;

        // Check each order's status
        for (const orderId of orderIds) {
            const order = await getOrder(orderId);
            if (order && order.status === 'open') {
                availableCount++;
            }
        }

        return availableCount;
    } catch (error) {
        console.error('[Twitter Store] Error checking order availability:', error);
        return 0; // Default to 0 if we can't check
    }
}

/**
 * Get triggers that need to be checked (active and within time bounds)
 */
export async function getTriggersToCheck(): Promise<TwitterTrigger[]> {
    const allTriggers = await listTwitterTriggers(true); // active only

    console.log(`[Twitter Store] All triggers:`, allTriggers);

    return allTriggers.filter(trigger => {
        // Check if max triggers reached
        if (trigger.maxTriggers && trigger.triggeredCount >= trigger.maxTriggers) {
            // Mark as inactive if max reached
            updateTwitterTrigger(trigger.id, { isActive: false });
            return false;
        }

        return true;
    });
}

/**
 * Sync Twitter execution statuses with current order statuses using smart status resolver
 */
export async function syncTwitterExecutionsWithOrders(): Promise<{
    executions_checked: number;
    executions_updated: number;
    status_sources: Record<string, number>;
    errors: string[];
}> {
    const result = {
        executions_checked: 0,
        executions_updated: 0,
        status_sources: {} as Record<string, number>,
        errors: [] as string[]
    };

    try {
        console.log('[Twitter Store] Starting sync of Twitter executions using smart status resolver...');

        // Get all Twitter executions that have an orderUuid or txid
        const allExecutions = await listAllTwitterExecutions(500);
        const executionsToCheck = allExecutions.filter(exec =>
            exec.orderUuid || exec.txid
        );

        result.executions_checked = executionsToCheck.length;
        console.log(`[Twitter Store] Found ${executionsToCheck.length} executions to check`);

        // Use the status resolver to batch process executions
        const { resolveMultipleExecutionStatuses } = await import('./status-resolver');
        const resolvedExecutions = await resolveMultipleExecutionStatuses(executionsToCheck);

        // Count results
        for (const resolved of resolvedExecutions) {
            // Count status sources
            result.status_sources[resolved.statusSource] = (result.status_sources[resolved.statusSource] || 0) + 1;

            // Count updates (status resolver handles the actual updating)
            if (resolved.resolvedStatus !== resolved.status) {
                result.executions_updated++;
            }
        }

        console.log(`[Twitter Store] Sync completed using status resolver:`, {
            checked: result.executions_checked,
            updated: result.executions_updated,
            sources: result.status_sources
        });

        return result;

    } catch (error) {
        const errorMsg = `Fatal error during sync: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[Twitter Store] ${errorMsg}`);
        result.errors.push(errorMsg);
        return result;
    }
}

/**
 * Add overflow signatures to an existing trigger and reactivate it
 */
export async function addOverflowSignaturesToTrigger(
    triggerId: string,
    signatures: Array<{
        uuid: string;
        signature: string;
        inputToken: string;
        outputToken: string;
        amountIn: string;
    }>
): Promise<{
    success: boolean;
    trigger?: TwitterTrigger;
    newOrderIds?: string[];
    error?: string;
}> {
    try {
        console.log(`[Twitter Store] Adding ${signatures.length} overflow signatures to trigger ${triggerId}`);

        // Get the existing trigger
        const trigger = await getTwitterTrigger(triggerId);
        if (!trigger) {
            return {
                success: false,
                error: 'Trigger not found'
            };
        }

        // Create orders from the new signatures
        const { addOrder } = await import('../orders/store');
        const newOrderIds: string[] = [];

        // Generate a single strategyId for all overflow orders in this batch
        const overflowStrategyId = `twitter_overflow_${triggerId}_${Date.now()}`;
        const batchSize = signatures.length;

        console.log(`[Twitter Store] Creating ${batchSize} overflow orders with shared strategy ID: ${overflowStrategyId}`);

        for (let i = 0; i < signatures.length; i++) {
            const sig = signatures[i];

            try {
                // Create order payload with shared strategy ID for proper grouping
                const orderPayload = {
                    owner: trigger.owner,
                    inputToken: sig.inputToken,
                    outputToken: sig.outputToken,
                    amountIn: sig.amountIn,
                    recipient: 'PLACEHOLDER', // Will be overridden when executed with BNS address
                    signature: sig.signature,
                    uuid: sig.uuid,
                    // Strategy metadata for grouping - all overflow orders share the same strategyId
                    strategyId: overflowStrategyId,
                    strategyType: 'twitter' as const,
                    strategyPosition: i + 1, // Position within the overflow batch (1-based)
                    strategySize: batchSize, // Size of the overflow batch only
                    strategyDescription: `Overflow batch for Twitter trigger ${trigger.tweetUrl} (${batchSize} orders)`,
                    // Order metadata
                    metadata: {
                        orderType: 'twitter_trigger_overflow',
                        createdFor: 'twitter-trigger-overflow-system',
                        tweetUrl: trigger.tweetUrl,
                        triggerId: trigger.id,
                        bulkSigned: true,
                        isOverflow: true,
                        overflowBatchId: overflowStrategyId,
                        originalTriggerOrderCount: trigger.orderIds?.length || 0
                    }
                };

                const order = await addOrder(orderPayload);
                newOrderIds.push(order.uuid);

                console.log(`[Twitter Store] Created overflow order ${i + 1}/${signatures.length}: ${order.uuid} (strategy: ${overflowStrategyId})`);

            } catch (orderError) {
                console.error(`[Twitter Store] Failed to create overflow order ${i + 1}:`, orderError);
                return {
                    success: false,
                    error: `Failed to create overflow order ${i + 1}: ${orderError instanceof Error ? orderError.message : 'Unknown error'}`
                };
            }
        }

        // Update the trigger with new order IDs and reactivate
        const existingOrderIds = trigger.orderIds || [];
        const allOrderIds = [...existingOrderIds, ...newOrderIds];
        const newAvailableOrders = await checkAvailableOrders(allOrderIds);

        const updatedTrigger = await updateTwitterTrigger(triggerId, {
            orderIds: allOrderIds,
            availableOrders: newAvailableOrders,
            isActive: true, // Reactivate the trigger
            lastChecked: new Date().toISOString(), // Reset last checked time for processing
        });

        if (!updatedTrigger) {
            return {
                success: false,
                error: 'Failed to update trigger'
            };
        }

        console.log(`[Twitter Store] ✅ Successfully added ${newOrderIds.length} overflow signatures to trigger ${triggerId}`);
        console.log(`[Twitter Store] 🟢 Trigger reactivated with ${newAvailableOrders} total available orders`);

        return {
            success: true,
            trigger: updatedTrigger,
            newOrderIds
        };

    } catch (error) {
        console.error(`[Twitter Store] Error adding overflow signatures to trigger ${triggerId}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Clean up old execution records (optional maintenance function)
 */
export async function cleanupOldExecutions(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    const allExecutions = await listAllTwitterExecutions(1000); // Get more for cleanup

    let deletedCount = 0;

    for (const execution of allExecutions) {
        if (new Date(execution.executedAt) < cutoffDate) {
            await kv.del(`${EXECUTION_PREFIX}${execution.id}`);
            await kv.srem(EXECUTION_LIST_KEY, execution.id);
            deletedCount++;
        }
    }

    console.log(`[Twitter Store] Cleaned up ${deletedCount} old execution records`);
    return deletedCount;
}