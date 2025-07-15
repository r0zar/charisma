/**
 * Activity monitoring integration for transaction monitor
 * Handles updating activity timeline when transactions change status
 */

import { kv } from '@vercel/kv';
import type { TransactionStatus } from './types';

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
 */
export async function notifyActivitySystem(payload: ActivityUpdatePayload): Promise<void> {
  try {
    console.log(`[TX-MONITOR] Notifying activity system: ${payload.txid} - ${payload.previousStatus} -> ${payload.currentStatus}`);

    // Send webhook to simple-swap app's activity monitoring endpoint
    const response = await fetch(
      `${process.env.SIMPLE_SWAP_URL || 'http://localhost:3002'}/api/v1/activity/webhook/transaction-update`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ACTIVITY_WEBHOOK_SECRET || 'dev-secret'}`
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      throw new Error(`Activity webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`[TX-MONITOR] Activity system notified successfully for ${payload.txid}`);

  } catch (error) {
    console.error(`[TX-MONITOR] Error notifying activity system for ${payload.txid}:`, error);

    // Store failed notification for retry
    await storeFailedNotification(payload);
  }
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

        // Update retry count
        const notification = JSON.parse(notificationStr as string);
        notification.retryCount = (notification.retryCount || 0) + 1;

        await kv.lrem('failed_activity_notifications', 1, notificationStr);
        await kv.lpush('failed_activity_notifications', JSON.stringify(notification));
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
  // Only notify if status actually changed
  if (previousStatus === currentStatus) {
    return;
  }

  // Get the transaction mapping
  const mapping = await getTransactionMapping(txid);
  if (!mapping) {
    console.warn(`[TX-MONITOR] No mapping found for transaction ${txid}, skipping activity notification`);
    return;
  }

  // Send notification to activity system
  await notifyActivitySystem({
    txid,
    recordId: mapping.recordId,
    recordType: mapping.recordType,
    previousStatus,
    currentStatus
  });
}