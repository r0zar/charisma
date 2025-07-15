/**
 * Client for interacting with tx-monitor service
 * Handles registering transactions for monitoring with activity integration
 */

interface TransactionRegistration {
  txid: string;
  recordId: string;
  recordType: 'order' | 'swap';
}

const TX_MONITOR_URL = process.env.TX_MONITOR_URL || 'http://localhost:3001';

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
    const response = await fetch(`${TX_MONITOR_URL}/api/v1/queue/add-with-mapping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactions
      })
    });
    
    if (!response.ok) {
      throw new Error(`TX Monitor API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to register transactions');
    }
    
    return {
      success: true,
      added: data.data.added || [],
      alreadyMonitored: data.data.alreadyMonitored || [],
      mappingsStored: data.data.mappingsStored || 0
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
  const result = await registerTransactionsForMonitoring([{
    txid,
    recordId,
    recordType
  }]);
  
  return {
    success: result.success,
    added: result.added,
    alreadyMonitored: result.alreadyMonitored
  };
}