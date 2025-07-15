/**
 * Client for interacting with tx-monitor service
 * Handles registering transactions for monitoring with activity integration
 * 
 * This file now uses the @packages/tx-monitor-client package for all functionality
 */

import { TxMonitorClient, type TransactionRegistration, type QueueAddWithMappingResponse } from '@repo/tx-monitor-client';

// Initialize the client
const txMonitorClient = new TxMonitorClient();

/**
 * Register transactions for monitoring with activity integration
 */
export async function registerTransactionsForMonitoring(
  transactions: TransactionRegistration[]
): Promise<{
  success: boolean;
  added: string[];
  alreadyMonitored: string[];
  mappingsStored: number;
}> {
  try {
    const result = await txMonitorClient.addToQueueWithMapping(transactions);
    
    return {
      success: result.success,
      added: result.added,
      alreadyMonitored: result.alreadyMonitored,
      mappingsStored: result.mappingsStored
    };
  } catch (error) {
    console.error('Error registering transactions for monitoring:', error);
    throw error;
  }
}

/**
 * Register a single transaction for monitoring
 */
export async function registerTransactionForMonitoring(
  txid: string,
  recordId: string,
  recordType: 'order' | 'swap'
): Promise<{
  success: boolean;
  added: string[];
  alreadyMonitored: string[];
}> {
  try {
    const result = await txMonitorClient.addTransactionWithMapping(txid, recordId, recordType);
    
    return {
      success: result.success,
      added: result.added,
      alreadyMonitored: result.alreadyMonitored
    };
  } catch (error) {
    console.error('Error registering transaction for monitoring:', error);
    throw error;
  }
}