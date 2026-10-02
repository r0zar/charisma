/** dropped: the network threw the transaction out of the mempool (replaced, expired, too expensive); it never ran */
export type TransactionStatus = 'success' | 'abort_by_response' | 'abort_by_post_condition' | 'dropped' | 'pending' | 'broadcasted' | 'not_found';

/** A status that won't change again: the transaction ran (either way), or the network dropped it */
export const isFinalStatus = (status: TransactionStatus) =>
  status === 'success' || status === 'abort_by_response' || status === 'abort_by_post_condition' || status === 'dropped';

export interface TransactionInfo {
  txid: string;
  status: TransactionStatus;
  blockHeight?: number;
  blockTime?: number;
  addedAt: number;
  lastChecked: number;
  checkCount: number;
}

export interface QueueAddRequest {
  txids: string[];
}

export interface QueueAddResponse {
  success: boolean;
  added: string[];
  alreadyMonitored: string[];
}

export interface StatusResponse {
  txid: string;
  status: TransactionStatus;
  blockHeight?: number;
  blockTime?: number;
  fromCache: boolean;
  checkedAt: number;
}

export interface QueueStatsResponse {
  queueSize: number;
  oldestTransaction?: string;
  oldestTransactionAge?: number;
  processingHealth: 'healthy' | 'warning' | 'error';
  totalProcessed: number;
  totalFailed: number;
  totalSuccessful: number;
}

export interface CronMonitorResult {
  processed: number;
  updated: number;
  removed: number;
  errors: string[];
  duration: number;
}

export interface ActivityMetrics {
  completed: number;
  pending: number;
  failed: number;
  cancelled: number;
  processing: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  queueSize: number;
  processed: number;
  successful: number;
  failed: number;
  oldestTransactionAge?: number;
  processingHealth: 'healthy' | 'warning' | 'error';
  // Activity metrics
  activities?: ActivityMetrics;
}

export interface MetricsHistoryResponse {
  metrics: MetricsSnapshot[];
  period: string;
  total: number;
}

export interface HealthCheckResponse {
  cron: 'healthy' | 'warning' | 'error';
  api: 'healthy' | 'warning' | 'error';
  queue: 'healthy' | 'warning' | 'error';
  lastCronRun?: number;
  kvConnectivity: boolean;
  uptime: number;
}