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
    const pipeline = kv.pipeline();
    for (const id of triggerIds) {
        pipeline.get(`${TRIGGER_PREFIX}${id}`);
    }
    const triggers = await pipeline.exec() as TwitterTrigger[];
    
    // Filter out null values and optionally inactive triggers
    const validTriggers = triggers.filter(trigger => 
        trigger && (!activeOnly || trigger.isActive)
    );
    
    // Update available orders for triggers that have pre-signed orders
    const triggersWithUpdatedCounts = await Promise.all(
        validTriggers.map(async (trigger) => {
            if (trigger.orderIds && trigger.orderIds.length > 0) {
                const availableOrders = await checkAvailableOrders(trigger.orderIds);
                
                // Update cached count if needed
                if (trigger.availableOrders !== availableOrders) {
                    await updateTwitterTrigger(trigger.id, { availableOrders });
                    return { ...trigger, availableOrders };
                }
            }
            return trigger;
        })
    );
    
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
    const now = Date.now();
    
    return allTriggers.filter(trigger => {
        // Check if within time bounds
        if (trigger.validFrom && new Date(trigger.validFrom).getTime() > now) {
            return false; // not yet active
        }
        
        if (trigger.validTo && new Date(trigger.validTo).getTime() < now) {
            // Mark as inactive if expired
            updateTwitterTrigger(trigger.id, { isActive: false });
            return false;
        }
        
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