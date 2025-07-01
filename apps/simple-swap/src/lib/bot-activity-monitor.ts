import { kv } from '@vercel/kv';
import { checkTransactionStatus, type TransactionStatus } from './transaction-monitor';
import type { BotActivityRecord, BotData } from '@/types/bot';

/**
 * Result of monitoring a single bot activity transaction
 */
export interface BotActivityMonitorResult {
    txid: string;
    activityId: string;
    botId: string;
    previousStatus: 'pending' | 'success' | 'failure';
    currentStatus: TransactionStatus;
    activityUpdated: boolean;
    error?: string;
}

/**
 * Get all bot activities that have pending transactions to monitor
 */
export async function getBotActivitiesNeedingMonitoring(): Promise<Array<{
    userAddress: string;
    botId: string;
    activity: BotActivityRecord;
}>> {
    const activities: Array<{
        userAddress: string;
        botId: string;
        activity: BotActivityRecord;
    }> = [];

    try {
        // Get all bot activity keys
        const activityKeys = await kv.keys('bot_activity:*');
        
        for (const key of activityKeys) {
            // Extract userAddress and botId from key: bot_activity:userAddress:botId
            const keyParts = key.split(':');
            if (keyParts.length !== 3) continue;
            
            const userAddress = keyParts[1];
            const botId = keyParts[2];
            
            // Get activities for this bot
            const botActivities = await kv.get<BotActivityRecord[]>(key);
            if (!botActivities || !Array.isArray(botActivities)) continue;
            
            // Find activities with pending status and txid
            for (const activity of botActivities) {
                if (activity.status === 'pending' && activity.txid) {
                    activities.push({
                        userAddress,
                        botId,
                        activity
                    });
                }
            }
        }

        console.log(`[BOT-ACTIVITY-MONITOR] Found ${activities.length} pending bot activities to monitor`);
        return activities;

    } catch (error) {
        console.error('[BOT-ACTIVITY-MONITOR] Error getting activities needing monitoring:', error);
        return [];
    }
}

/**
 * Monitor a single bot activity transaction and update its status
 */
export async function monitorBotActivityTransaction(
    userAddress: string,
    botId: string,
    activity: BotActivityRecord
): Promise<BotActivityMonitorResult> {
    const result: BotActivityMonitorResult = {
        txid: activity.txid!,
        activityId: activity.id,
        botId,
        previousStatus: activity.status,
        currentStatus: 'pending',
        activityUpdated: false
    };

    try {
        if (!activity.txid) {
            throw new Error('Activity has no transaction ID');
        }

        // Check current transaction status on blockchain
        const txStatus = await checkTransactionStatus(activity.txid);
        result.currentStatus = txStatus.status;

        // Only update if status has changed
        if (txStatus.status !== activity.status) {
            console.log(`[BOT-ACTIVITY-MONITOR] Status change for activity ${activity.id}: ${activity.status} -> ${txStatus.status}`);

            // Get current activities for this bot
            const activityKey = `bot_activity:${userAddress}:${botId}`;
            const currentActivities = await kv.get<BotActivityRecord[]>(activityKey) || [];

            // Find and update the specific activity
            const updatedActivities = currentActivities.map(act => {
                if (act.id === activity.id) {
                    return {
                        ...act,
                        status: txStatus.status as 'success' | 'failure' | 'pending',
                        // Add block info if transaction was confirmed
                        blockHeight: txStatus.blockHeight,
                        blockTime: txStatus.blockTime ? new Date(txStatus.blockTime * 1000).toISOString() : undefined
                    };
                }
                return act;
            });

            // Save updated activities
            await kv.set(activityKey, updatedActivities);
            result.activityUpdated = true;

            console.log(`[BOT-ACTIVITY-MONITOR] Updated activity ${activity.id} status to ${txStatus.status}`);
        }

    } catch (error) {
        console.error(`[BOT-ACTIVITY-MONITOR] Error monitoring activity ${activity.id}:`, error);
        result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
}

/**
 * Monitor all pending bot activity transactions
 */
export async function monitorAllBotActivities(): Promise<{
    activitiesChecked: number;
    activitiesUpdated: number;
    successfulTransactions: number;
    failedTransactions: number;
    stillPending: number;
    errors: string[];
    results: BotActivityMonitorResult[];
}> {
    const result = {
        activitiesChecked: 0,
        activitiesUpdated: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        stillPending: 0,
        errors: [],
        results: []
    };

    try {
        const activitiesToCheck = await getBotActivitiesNeedingMonitoring();
        result.activitiesChecked = activitiesToCheck.length;

        if (activitiesToCheck.length === 0) {
            return result;
        }

        // Monitor each activity
        for (const { userAddress, botId, activity } of activitiesToCheck) {
            try {
                const monitorResult = await monitorBotActivityTransaction(userAddress, botId, activity);
                result.results.push(monitorResult);

                if (monitorResult.error) {
                    result.errors.push(`Activity ${activity.id}: ${monitorResult.error}`);
                } else {
                    // Count status changes
                    if (monitorResult.currentStatus === 'success') {
                        result.successfulTransactions++;
                        if (monitorResult.activityUpdated) {
                            result.activitiesUpdated++;
                        }
                    } else if (monitorResult.currentStatus === 'abort_by_response' || monitorResult.currentStatus === 'abort_by_post_condition') {
                        result.failedTransactions++;
                        if (monitorResult.activityUpdated) {
                            result.activitiesUpdated++;
                        }
                    } else if (monitorResult.currentStatus === 'pending') {
                        result.stillPending++;
                    }
                }

            } catch (error) {
                console.error(`[BOT-ACTIVITY-MONITOR] Error monitoring activity ${activity.id}:`, error);
                result.errors.push(`Error monitoring activity ${activity.id}: ${error}`);
            }
        }

    } catch (error) {
        console.error('[BOT-ACTIVITY-MONITOR] Error in monitorAllBotActivities:', error);
        result.errors.push(`Fatal error: ${error}`);
    }

    return result;
}