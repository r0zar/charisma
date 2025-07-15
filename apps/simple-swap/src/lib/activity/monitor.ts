/**
 * Activity monitoring service
 * Extends existing transaction monitoring to update activity timeline
 */

import { syncSingleRecord } from './ingestion';
import { updateActivity } from './storage';
import { ActivityStatus } from './types';
import { registerTransactionForMonitoring } from './tx-monitor-client';

/**
 * Map transaction status to activity status
 */
function mapTransactionToActivityStatus(txStatus: string): ActivityStatus {
  switch (txStatus) {
    case 'success':
      return 'completed';
    case 'abort_by_response':
    case 'abort_by_post_condition':
      return 'failed';
    case 'pending':
    case 'broadcasted':
      return 'pending';
    default:
      return 'pending';
  }
}

/**
 * Handle transaction status update for activity timeline
 * This function is called by the transaction monitoring webhook
 */
export async function handleTransactionUpdate(
  txid: string,
  recordId: string,
  recordType: 'order' | 'swap',
  previousStatus: string,
  currentStatus: string
): Promise<void> {
  try {
    console.log(`Transaction update: ${txid} - ${previousStatus} -> ${currentStatus}`);
    
    // Map transaction status to activity status
    const activityStatus = mapTransactionToActivityStatus(currentStatus);
    
    // Update activity in timeline
    await updateActivity(recordId, {
      status: activityStatus,
      txid: txid,
      // Add timestamp for status change
      metadata: {
        lastStatusUpdate: Date.now(),
        txStatus: currentStatus
      }
    });
    
    // Sync the record to ensure latest data
    await syncSingleRecord(recordId, recordType, 'update');
    
    console.log(`Activity ${recordId} updated to status: ${activityStatus}`);
    
  } catch (error) {
    console.error(`Error updating activity for transaction ${txid}:`, error);
  }
}

/**
 * Register a transaction for monitoring with activity integration
 * This should be called when a new transaction is created
 */
export async function registerTransactionForActivityMonitoring(
  txid: string,
  recordId: string,
  recordType: 'order' | 'swap'
): Promise<void> {
  try {
    console.log(`Registering transaction for activity monitoring: ${txid} -> ${recordType} ${recordId}`);
    
    const result = await registerTransactionForMonitoring(txid, recordId, recordType);
    
    if (result.success) {
      console.log(`Transaction ${txid} registered successfully for activity monitoring`);
    } else {
      console.warn(`Failed to register transaction ${txid} for activity monitoring`);
    }
    
  } catch (error) {
    console.error(`Error registering transaction ${txid} for activity monitoring:`, error);
    // Don't throw - this is not critical for the main flow
  }
}

/**
 * Handle new record creation (when order/swap is created)
 */
export async function handleRecordCreation(
  recordId: string,
  recordType: 'order' | 'swap' | 'twitter' | 'bot' | 'perp'
): Promise<void> {
  try {
    console.log(`New record created: ${recordType} ${recordId}`);
    
    // Sync the new record to activity timeline
    await syncSingleRecord(recordId, recordType, 'create');
    
    console.log(`Activity created for ${recordType} ${recordId}`);
    
  } catch (error) {
    console.error(`Error creating activity for ${recordType} ${recordId}:`, error);
  }
}

/**
 * Handle record deletion
 */
export async function handleRecordDeletion(
  recordId: string,
  recordType: 'order' | 'swap' | 'twitter' | 'bot' | 'perp'
): Promise<void> {
  try {
    console.log(`Record deleted: ${recordType} ${recordId}`);
    
    // Remove from activity timeline
    await syncSingleRecord(recordId, recordType, 'delete');
    
    console.log(`Activity deleted for ${recordType} ${recordId}`);
    
  } catch (error) {
    console.error(`Error deleting activity for ${recordType} ${recordId}:`, error);
  }
}

/**
 * Handle order status changes (from order system)
 */
export async function handleOrderStatusChange(
  orderId: string,
  previousStatus: string,
  newStatus: string,
  txid?: string
): Promise<void> {
  try {
    console.log(`Order status change: ${orderId} - ${previousStatus} -> ${newStatus}`);
    
    let activityStatus: ActivityStatus;
    
    switch (newStatus) {
      case 'filled':
      case 'confirmed':
        activityStatus = 'completed';
        break;
      case 'cancelled':
        activityStatus = 'cancelled';
        break;
      case 'failed':
        activityStatus = 'failed';
        break;
      default:
        activityStatus = 'pending';
    }
    
    // Update activity
    await updateActivity(orderId, {
      status: activityStatus,
      txid: txid,
      metadata: {
        lastStatusUpdate: Date.now(),
        orderStatus: newStatus
      }
    });
    
    console.log(`Activity ${orderId} updated to status: ${activityStatus}`);
    
  } catch (error) {
    console.error(`Error updating activity for order ${orderId}:`, error);
  }
}

/**
 * Handle swap completion
 */
export async function handleSwapCompletion(
  swapId: string,
  status: 'completed' | 'failed',
  txid?: string,
  outputAmount?: string
): Promise<void> {
  try {
    console.log(`Swap completion: ${swapId} - ${status}`);
    
    const updateData: any = {
      status: status,
      metadata: {
        lastStatusUpdate: Date.now(),
        completedAt: Date.now()
      }
    };
    
    if (txid) {
      updateData.txid = txid;
    }
    
    if (outputAmount) {
      updateData.toToken = {
        amount: outputAmount
      };
    }
    
    await updateActivity(swapId, updateData);
    
    console.log(`Activity ${swapId} updated to status: ${status}`);
    
  } catch (error) {
    console.error(`Error updating activity for swap ${swapId}:`, error);
  }
}

/**
 * Handle Twitter trigger execution
 */
export async function handleTwitterTriggerExecution(
  triggerId: string,
  status: 'pending' | 'completed' | 'failed',
  txid?: string,
  orderUuid?: string
): Promise<void> {
  try {
    console.log(`Twitter trigger execution: ${triggerId} - ${status}`);
    
    const activityStatus = status === 'completed' ? 'completed' : 
                          status === 'failed' ? 'failed' : 'pending';
    
    await updateActivity(triggerId, {
      status: activityStatus,
      txid: txid,
      metadata: {
        lastStatusUpdate: Date.now(),
        orderUuid: orderUuid,
        twitterStatus: status
      }
    });
    
    console.log(`Activity ${triggerId} updated to status: ${activityStatus}`);
    
  } catch (error) {
    console.error(`Error updating activity for Twitter trigger ${triggerId}:`, error);
  }
}

/**
 * Integration helper to be called from existing transaction monitor
 */
export async function integrateWithTransactionMonitor() {
  // This would be integrated into the existing transaction monitoring cron job
  // The existing monitor would call these functions when it detects status changes
  
  console.log('Activity monitor integration ready');
  
  // Return functions that can be called by existing monitor
  return {
    handleTransactionUpdate,
    handleRecordCreation,
    handleRecordDeletion,
    handleOrderStatusChange,
    handleSwapCompletion,
    handleTwitterTriggerExecution
  };
}

/**
 * Scheduled sync function (can be called by cron)
 */
export async function scheduledActivitySync(): Promise<void> {
  try {
    console.log('Starting scheduled activity sync...');
    
    const { runIncrementalIngestion } = await import('./ingestion');
    
    // Run incremental sync for the last hour
    const lastHour = Date.now() - (60 * 60 * 1000);
    const result = await runIncrementalIngestion(lastHour);
    
    console.log('Scheduled activity sync completed:', result);
    
  } catch (error) {
    console.error('Error in scheduled activity sync:', error);
  }
}