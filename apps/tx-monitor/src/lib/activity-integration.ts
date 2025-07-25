/**
 * Activity monitoring integration for transaction monitor
 * Handles updating activity timeline when transactions change status
 */

import { kv } from '@vercel/kv';
import type { TransactionStatus } from './types';
import { addActivity, updateActivity, getActivity } from './activity-storage';
import { createActivityFromTransaction, createActivityFromUnknownTransaction, createActivityFromSuccessfulTransaction, mapTransactionStatusToActivity } from './activity-adapters';
import { ActivityItem } from './activity-types';
import { analyzeTransaction, extractActualOutputAmount } from './extract-actual-amounts';

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
    console.log(`[TX-MONITOR] Stored mapping for ${txid} -> ${recordType} ${recordId} (activity will be created when transaction completes)`);
    
    // NOTE: No longer creating initial activity here - wait for transaction success
    // This prevents activities with outputAmount = 0
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
 * Update activity by searching for matching txid, or create new activity for successful transactions
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
      
      // If transaction succeeded and we have mapping, create activity with real data
      if (currentStatus === 'success') {
        await createActivityOnTransactionSuccess(txid);
      } else if (currentStatus === 'abort_by_response' || currentStatus === 'abort_by_post_condition') {
        await createActivityOnTransactionFailure(txid, currentStatus);
      }
      return;
    }
    
    const activityStatus = mapTransactionStatusToActivity(currentStatus);
    
    // Enhanced metadata with transaction analysis for successful transactions
    let enhancedMetadata = {
      ...matchingActivity.metadata,
      lastStatusUpdate: Date.now(),
      txStatus: currentStatus
    };

    // Add comprehensive transaction analysis for successful swaps
    if (currentStatus === 'success' && matchingActivity.type === 'instant_swap' && matchingActivity.owner) {
      try {
        console.log(`[TX-MONITOR] Performing transaction analysis for successful swap ${txid}`);
        
        // Extract actual output amount and store it
        const actualAmount = await extractActualOutputAmount(
          txid, 
          matchingActivity.owner, 
          matchingActivity.toToken.contractId
        );

        if (actualAmount) {
          console.log(`[TX-MONITOR] Extracted actual amount: ${actualAmount} for expected token: ${matchingActivity.toToken.contractId}`);
          
          // Get quoted amount from current activity data for slippage calculation
          const quotedAmount = matchingActivity.toToken.amount;
          
          // Perform comprehensive transaction analysis
          const analysis = await analyzeTransaction(
            txid,
            matchingActivity.owner,
            matchingActivity.toToken.contractId,
            quotedAmount
          );

          if (analysis) {
            enhancedMetadata.transactionAnalysis = analysis;
            console.log(`[TX-MONITOR] Added transaction analysis to activity ${matchingActivity.id}`);
            
            if (analysis.analysis.slippage) {
              console.log(`[TX-MONITOR] Slippage detected: ${analysis.analysis.slippage.slippagePercent.toFixed(2)}%`);
            }
          }
        }
      } catch (error) {
        console.error(`[TX-MONITOR] Error performing transaction analysis for ${txid}:`, error);
        // Don't fail the status update if analysis fails
      }
    }
    
    // Prepare activity updates
    let activityUpdates: any = {
      status: activityStatus,
      metadata: enhancedMetadata
    };

    // CRITICAL FIX: Update toToken amount with real amount from transaction analysis
    if (enhancedMetadata.transactionAnalysis?.analysis?.finalOutputAmount) {
      const realAmount = enhancedMetadata.transactionAnalysis.analysis.finalOutputAmount;
      console.log(`[TX-MONITOR] Updating toToken amount from ${matchingActivity.toToken.amount} to ${realAmount}`);
      
      activityUpdates.toToken = {
        ...matchingActivity.toToken,
        amount: realAmount
      };
    }

    // Update the activity with status, metadata, and corrected amounts
    await updateActivity(matchingActivity.id, activityUpdates);
    
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
 * NOTE: This function is deprecated - activities are now created on transaction success
 */
export async function createInitialActivity(
  txid: string,
  recordId: string,
  recordType: 'order' | 'swap'
): Promise<void> {
  console.log(`[TX-MONITOR] createInitialActivity called but deprecated for ${recordType} ${recordId}, txid: ${txid}`);
  // This function is no longer used to prevent creating activities with outputAmount = 0
}

/**
 * Create activity when transaction succeeds, using real amounts from on-chain data
 */
async function createActivityOnTransactionSuccess(txid: string): Promise<void> {
  try {
    console.log(`[TX-MONITOR] Creating activity for successful transaction: ${txid}`);
    
    // Get transaction mapping
    const mapping = await getTransactionMapping(txid);
    if (!mapping) {
      console.log(`[TX-MONITOR] No mapping found for successful transaction ${txid}, creating unknown transaction activity`);
      await createActivityForUnknownTransaction(txid, 'success');
      return;
    }

    console.log(`[TX-MONITOR] Found mapping for successful transaction ${txid}: ${mapping.recordType} ${mapping.recordId}`);
    
    // Create activity with correct amounts from transaction data
    const activity = await createActivityFromSuccessfulTransaction(txid, mapping.recordId, mapping.recordType);
    if (!activity) {
      console.warn(`[TX-MONITOR] Failed to create activity for successful transaction ${txid}`);
      return;
    }

    // Set the activity ID to match the record ID for easier updates
    activity.id = mapping.recordId;
    
    // Add to activity storage
    await addActivity(activity);
    
    console.log(`[TX-MONITOR] Created activity for successful transaction: ${activity.id} (${activity.type})`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error creating activity for successful transaction ${txid}:`, error);
  }
}

/**
 * Create activity when transaction fails
 */
async function createActivityOnTransactionFailure(txid: string, failureStatus: TransactionStatus): Promise<void> {
  try {
    console.log(`[TX-MONITOR] Creating activity for failed transaction: ${txid} (${failureStatus})`);
    
    // Get transaction mapping
    const mapping = await getTransactionMapping(txid);
    if (!mapping) {
      console.log(`[TX-MONITOR] No mapping found for failed transaction ${txid}, creating unknown transaction activity`);
      await createActivityForUnknownTransaction(txid, failureStatus);
      return;
    }

    console.log(`[TX-MONITOR] Found mapping for failed transaction ${txid}: ${mapping.recordType} ${mapping.recordId}`);
    
    // Create activity from original transaction data (will have attempted amounts)
    const activity = await createActivityFromTransaction(txid, mapping.recordId, mapping.recordType);
    if (!activity) {
      console.warn(`[TX-MONITOR] Failed to create activity for failed transaction ${txid}`);
      return;
    }

    // Set failure status and add failure metadata
    activity.id = mapping.recordId;
    activity.status = mapTransactionStatusToActivity(failureStatus);
    activity.metadata = {
      ...activity.metadata,
      lastStatusUpdate: Date.now(),
      txStatus: failureStatus,
      notes: `Transaction failed: ${failureStatus}`
    };
    
    // Add to activity storage
    await addActivity(activity);
    
    console.log(`[TX-MONITOR] Created activity for failed transaction: ${activity.id} (${activity.type}) - status: ${activity.status}`);
  } catch (error) {
    console.error(`[TX-MONITOR] Error creating activity for failed transaction ${txid}:`, error);
  }
}