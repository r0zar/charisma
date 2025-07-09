import type { TransactionStatus, StatusResponse } from './types';

export function isTransactionFinal(status: TransactionStatus): boolean {
  return status === 'success' || 
         status === 'abort_by_response' || 
         status === 'abort_by_post_condition' || 
         status === 'not_found';
}

export function isTransactionSuccessful(status: TransactionStatus): boolean {
  return status === 'success';
}

export function isTransactionFailed(status: TransactionStatus): boolean {
  return status === 'abort_by_response' || 
         status === 'abort_by_post_condition' || 
         status === 'not_found';
}

export function isTransactionPending(status: TransactionStatus): boolean {
  return status === 'pending' || status === 'broadcasted';
}

export function getStatusPriority(status: TransactionStatus): number {
  const priorities = {
    'success': 0,
    'abort_by_response': 1,
    'abort_by_post_condition': 2,
    'not_found': 3,
    'pending': 4,
    'broadcasted': 5
  };
  return priorities[status] ?? 99;
}

export function formatTransactionAge(timestamp: number): string {
  const age = Date.now() - timestamp;
  const seconds = Math.floor(age / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ago`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s ago`;
  } else {
    return `${seconds}s ago`;
  }
}

export function validateTransactionId(txid: string): boolean {
  if (!txid || typeof txid !== 'string') {
    return false;
  }
  
  const cleanTxid = txid.trim();
  
  if (cleanTxid.length < 10) {
    return false;
  }
  
  if (cleanTxid.startsWith('0x')) {
    return cleanTxid.length === 66 && /^0x[a-fA-F0-9]{64}$/.test(cleanTxid);
  }
  
  return cleanTxid.length === 64 && /^[a-fA-F0-9]{64}$/.test(cleanTxid);
}

export function normalizeTransactionId(txid: string): string {
  if (!txid || typeof txid !== 'string') {
    throw new Error('Invalid transaction ID');
  }
  
  const cleanTxid = txid.trim();
  
  if (cleanTxid.startsWith('0x')) {
    return cleanTxid;
  }
  
  return `0x${cleanTxid}`;
}

export function createPollingProgressTracker(
  onProgress?: (progress: { attempts: number; elapsed: number; status?: TransactionStatus }) => void
) {
  const startTime = Date.now();
  let attempts = 0;
  
  return {
    onStatusChange: (status: StatusResponse) => {
      attempts++;
      if (onProgress) {
        onProgress({
          attempts,
          elapsed: Date.now() - startTime,
          status: status.status
        });
      }
    },
    onError: () => {
      attempts++;
      if (onProgress) {
        onProgress({
          attempts,
          elapsed: Date.now() - startTime
        });
      }
    }
  };
}

export class TransactionStatusTracker {
  private statusHistory: Array<{ status: TransactionStatus; timestamp: number }> = [];
  private callbacks: Array<(status: TransactionStatus, previous?: TransactionStatus) => void> = [];

  addStatus(status: TransactionStatus): void {
    const previous = this.statusHistory.length > 0 ? this.statusHistory[this.statusHistory.length - 1].status : undefined;
    
    this.statusHistory.push({
      status,
      timestamp: Date.now()
    });

    if (previous !== status) {
      this.callbacks.forEach(callback => callback(status, previous));
    }
  }

  onStatusChange(callback: (status: TransactionStatus, previous?: TransactionStatus) => void): void {
    this.callbacks.push(callback);
  }

  getCurrentStatus(): TransactionStatus | undefined {
    return this.statusHistory.length > 0 ? this.statusHistory[this.statusHistory.length - 1].status : undefined;
  }

  getStatusHistory(): Array<{ status: TransactionStatus; timestamp: number }> {
    return [...this.statusHistory];
  }

  getDuration(): number {
    if (this.statusHistory.length === 0) return 0;
    
    const first = this.statusHistory[0];
    const last = this.statusHistory[this.statusHistory.length - 1];
    
    return last.timestamp - first.timestamp;
  }

  getStatusDuration(status: TransactionStatus): number {
    let duration = 0;
    let startTime: number | null = null;

    for (const entry of this.statusHistory) {
      if (entry.status === status && startTime === null) {
        startTime = entry.timestamp;
      } else if (entry.status !== status && startTime !== null) {
        duration += entry.timestamp - startTime;
        startTime = null;
      }
    }

    if (startTime !== null) {
      duration += Date.now() - startTime;
    }

    return duration;
  }

  clear(): void {
    this.statusHistory = [];
    this.callbacks = [];
  }
}

export function createBatchProcessor<T, R>(
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
) {
  return async function processBatch(items: T[]): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }
    
    return results;
  };
}