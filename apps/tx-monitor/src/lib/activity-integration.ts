/**
 * Activity monitoring integration for transaction monitor
 * Handles updating activity timeline when transactions change status
 */

import { kv } from '@vercel/kv';
import type { TransactionStatus } from './types';
import { addActivity, updateActivity, getActivity } from './activity-storage';
import { createActivityFromTransaction, createActivityFromUnknownTransaction, mapTransactionStatusToActivity } from './activity-adapters';
import { ActivityItem } from './activity-types';

interface ActivityUpdatePayload {
  txid: string;
  recordId: string;
  recordType: 'order' | 'swap';
  previousStatus: TransactionStatus;
  currentStatus: TransactionStatus;
}

/**
 * Store transaction-to-record mapping when transactions are added to queue
 */
export async function storeTransactionMapping(
  txid: string,
  recordId: string,
  recordType: 'order' | 'swap'
): Promise<void> {
  try {
    const mapping = {
      recordId,
      recordType,
      timestamp: Date.now()
    };

    await kv.set(`tx_mapping:${txid}`, mapping, { ex: 7 * 24 * 60 * 60 }); // Keep for 7 days
    console.log(`[TX-MONITOR] Stored mapping for ${txid} -> ${recordType} ${recordId}`);
    
    // Create initial activity for this transaction
    await createInitialActivity(txid, recordId, recordType);
  } catch (error) {
    console.error(`[TX-MONITOR] Error storing transaction mapping for ${txid}:`, error);
  }
}

/**
 * Get transaction-to-record mapping
 */
export async function getTransactionMapping(txid: string): Promise<{
  recordId: string;
  recordType: 'order' | 'swap';
  timestamp: number;
} | null> {
  try {
    const mapping = await kv.get(`tx_mapping:${txid}`);
    return mapping as any;
  } catch (error) {
    console.error(`[TX-MONITOR] Error getting transaction mapping for ${txid}:`, error);
    return null;
  }
}

/**
 * Send transaction update to activity system
 * NOTE: This function is now deprecated since we manage activities directly in tx-monitor
 */
export async function notifyActivitySystem(payload: ActivityUpdatePayload): Promise<void> {
  // This function is no longer needed since we manage activities directly
  console.log(`[TX-MONITOR] notifyActivitySystem called but deprecated: ${payload.txid} - ${payload.previousStatus} -> ${payload.currentStatus}`);
}

/**
 * Store failed activity notification for retry
 */
async function storeFailedNotification(payload: ActivityUpdatePayload): Promise<void> {
  try {
    const failedNotification = {
      ...payload,
      failedAt: Date.now(),
      retryCount: 0
    };

    await kv.lpush('failed_activity_notifications', JSON.stringify(failedNotification));
    console.log(`[TX-MONITOR] Stored failed notification for retry: ${payload.txid}`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error storing failed notification for ${payload.txid}:`, error);
  }
}

/**
 * Retry failed activity notifications
 */
export async function retryFailedNotifications(): Promise<void> {
  try {
    const failedNotifications = await kv.lrange('failed_activity_notifications', 0, 10);

    for (const notificationStr of failedNotifications) {
      try {
        // Validate that notificationStr is a proper JSON string
        if (!notificationStr || typeof notificationStr !== 'string' || notificationStr === '[object Object]') {
          console.warn('[TX-MONITOR] Skipping corrupted notification data:', notificationStr);
          await kv.lrem('failed_activity_notifications', 1, notificationStr);
          continue;
        }

        const notification = JSON.parse(notificationStr as string);

        // Skip if too many retries
        if (notification.retryCount >= 5) {
          await kv.lrem('failed_activity_notifications', 1, notificationStr);
          continue;
        }

        // Skip if too old (older than 1 hour)
        if (Date.now() - notification.failedAt > 60 * 60 * 1000) {
          await kv.lrem('failed_activity_notifications', 1, notificationStr);
          continue;
        }

        // Retry notification
        await notifyActivitySystem({
          txid: notification.txid,
          recordId: notification.recordId,
          recordType: notification.recordType,
          previousStatus: notification.previousStatus,
          currentStatus: notification.currentStatus
        });

        // Remove from failed queue on success
        await kv.lrem('failed_activity_notifications', 1, notificationStr);

      } catch (error) {
        console.error('[TX-MONITOR] Error retrying failed notification:', error);

        // Validate notification data before updating retry count
        if (!notificationStr || typeof notificationStr !== 'string' || notificationStr === '[object Object]') {
          console.warn('[TX-MONITOR] Removing corrupted notification from failed queue:', notificationStr);
          await kv.lrem('failed_activity_notifications', 1, notificationStr);
          continue;
        }

        try {
          // Update retry count
          const notification = JSON.parse(notificationStr as string);
          notification.retryCount = (notification.retryCount || 0) + 1;

          await kv.lrem('failed_activity_notifications', 1, notificationStr);
          await kv.lpush('failed_activity_notifications', JSON.stringify(notification));
        } catch (parseError) {
          console.error('[TX-MONITOR] Failed to parse notification for retry count update:', parseError);
          // Remove corrupted data
          await kv.lrem('failed_activity_notifications', 1, notificationStr);
        }
      }
    }
  } catch (error) {
    console.error('[TX-MONITOR] Error processing failed notifications:', error);
  }
}

/**
 * Handle transaction status update for activity integration
 */
export async function handleTransactionStatusUpdate(
  txid: string,
  previousStatus: TransactionStatus,
  currentStatus: TransactionStatus
): Promise<void> {
  console.log(`[TX-MONITOR] handleTransactionStatusUpdate: ${txid} - ${previousStatus} → ${currentStatus}`);
  
  // Only process if status actually changed
  if (previousStatus === currentStatus) {
    console.log(`[TX-MONITOR] Status unchanged for ${txid}, skipping update`);
    return;
  }

  // First, try to find activity by txid directly
  await updateActivityByTxid(txid, currentStatus);

  // Also check for transaction mapping for backward compatibility
  const mapping = await getTransactionMapping(txid);
  
  if (!mapping) {
    console.log(`[TX-MONITOR] No mapping found for transaction ${txid}, activity should have been updated by txid`);
    return;
  }

  console.log(`[TX-MONITOR] Found mapping for ${txid}: ${mapping.recordType} ${mapping.recordId}`);
  
  // Update existing activity via mapping as fallback
  await updateExistingActivity(mapping.recordId, txid, currentStatus);
}

/**
 * Create activity for unknown transaction (no mapping found)
 */
async function createActivityForUnknownTransaction(
  txid: string,
  currentStatus: TransactionStatus
): Promise<void> {
  try {
    // Create a generic activity for unknown transactions
    const activity = await createActivityFromUnknownTransaction(txid);
    if (!activity) {
      console.warn(`[TX-MONITOR] Failed to create activity for unknown transaction ${txid}`);
      return;
    }

    // Set the current status
    activity.status = mapTransactionStatusToActivity(currentStatus);
    
    // Add to activity storage
    await addActivity(activity);
    
    console.log(`[TX-MONITOR] Created activity for unknown transaction ${txid}: ${activity.id}`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error creating activity for unknown transaction ${txid}:`, error);
  }
}

/**
 * Update activity by searching for matching txid
 */
async function updateActivityByTxid(
  txid: string,
  currentStatus: TransactionStatus
): Promise<void> {
  try {
    // Import activity storage functions
    const { getActivityTimeline } = await import('./activity-storage');
    
    // Get recent activities to find one matching this txid
    const timeline = await getActivityTimeline({ limit: 100 });
    const matchingActivity = timeline.activities.find(activity => activity.txid === txid);
    
    if (!matchingActivity) {
      console.log(`[TX-MONITOR] No activity found with txid: ${txid}`);
      return;
    }
    
    const activityStatus = mapTransactionStatusToActivity(currentStatus);
    
    // Update the activity status
    await updateActivity(matchingActivity.id, {
      status: activityStatus,
      metadata: {
        ...matchingActivity.metadata,
        lastStatusUpdate: Date.now(),
        txStatus: currentStatus
      }
    });
    
    console.log(`[TX-MONITOR] Updated activity ${matchingActivity.id} (txid: ${txid}) to status: ${activityStatus}`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error updating activity by txid ${txid}:`, error);
  }
}

/**
 * Update existing activity based on transaction status change
 */
async function updateExistingActivity(
  recordId: string,
  txid: string,
  currentStatus: TransactionStatus
): Promise<void> {
  try {
    // First, check if we already have an activity for this record
    // We'll need to find the activity by txid or recordId
    const activityStatus = mapTransactionStatusToActivity(currentStatus);
    
    // Update the activity status
    await updateActivity(recordId, {
      status: activityStatus,
      txid: txid,
      metadata: {
        lastStatusUpdate: Date.now(),
        txStatus: currentStatus
      }
    });
    
    console.log(`[TX-MONITOR] Updated activity ${recordId} to status: ${activityStatus}`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error updating activity ${recordId}:`, error);
  }
}

/**
 * Add activity transactions to monitoring queue
 * This ensures that activities with transaction IDs are automatically monitored
 */
export async function addActivityTransactionsToQueue(): Promise<void> {
  try {
    console.log(`[TX-MONITOR] Adding activity transactions to monitoring queue`);
    
    // Import required functions
    const { getActivityTimeline } = await import('./activity-storage');
    const { addToQueue } = await import('./transaction-monitor');
    
    // Get activities with transaction IDs that are still pending
    const timeline = await getActivityTimeline({ limit: 200 });
    const pendingActivitiesWithTxids = timeline.activities.filter(activity => 
      activity.txid && 
      (activity.status === 'pending' || activity.status === 'processing')
    );
    
    if (pendingActivitiesWithTxids.length === 0) {
      console.log(`[TX-MONITOR] No pending activities with transaction IDs found`);
      return;
    }
    
    const txidsToAdd = pendingActivitiesWithTxids.map(activity => activity.txid!);
    
    console.log(`[TX-MONITOR] Adding ${txidsToAdd.length} activity transaction IDs to monitoring queue`);
    
    const result = await addToQueue(txidsToAdd);
    
    console.log(`[TX-MONITOR] Queue update result: added=${result.added.length}, already_monitored=${result.alreadyMonitored.length}`);
    
    if (result.added.length > 0) {
      console.log(`[TX-MONITOR] Successfully added transaction IDs: ${result.added.join(', ')}`);
    }
    
  } catch (error) {
    console.error(`[TX-MONITOR] Error adding activity transactions to queue:`, error);
  }
}

/**
 * Create initial activity when a transaction is first added with mapping
 */
export async function createInitialActivity(
  txid: string,
  recordId: string,
  recordType: 'order' | 'swap'
): Promise<void> {
  try {
    console.log(`[TX-MONITOR] Creating initial activity for ${recordType} ${recordId}, txid: ${txid}`);
    
    // Create activity from transaction mapping
    const activity = await createActivityFromTransaction(txid, recordId, recordType);
    if (!activity) {
      console.warn(`[TX-MONITOR] Failed to create activity for ${recordType} ${recordId}`);
      return;
    }

    // Set the activity ID to match the record ID for easier updates
    activity.id = recordId;
    
    // Add to activity storage
    await addActivity(activity);
    
    console.log(`[TX-MONITOR] Created initial activity: ${activity.id} (${activity.type})`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error creating initial activity for ${recordType} ${recordId}:`, error);
  }
}