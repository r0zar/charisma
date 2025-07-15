/**
 * Client wrapper for tx-monitor service with activity integration
 * 
 * This file provides simplified wrappers around @packages/tx-monitor-client
 * for registering transactions with activity monitoring integration.
 */

import { TxMonitorClient, type TransactionRegistration, type QueueAddWithMappingResponse } from '@repo/tx-monitor-client';

// Initialize the client
const txMonitorClient = new TxMonitorClient();

/**
 * Register transactions for monitoring with activity integration
 */
export async function registerTransactionsForMonitoring(
  transactions: TransactionRegistration[]
): Promise<QueueAddWithMappingResponse> {
  try {
    return await txMonitorClient.addToQueueWithMapping(transactions);
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
): Promise<QueueAddWithMappingResponse> {
  try {
    return await txMonitorClient.addTransactionWithMapping(txid, recordId, recordType);
  } catch (error) {
    console.error('Error registering transaction for monitoring:', error);
    throw error;
  }
}