export { TxMonitorClient } from './client';
import { TxMonitorClient } from './client';
import type { TxMonitorConfig } from './types';
export * from './types';
export * from './utils';

export type {
  TransactionStatus,
  TransactionInfo,
  QueueAddRequest,
  QueueAddResponse,
  StatusResponse,
  QueueStatsResponse,
  CronMonitorResult,
  MetricsSnapshot,
  MetricsHistoryResponse,
  HealthCheckResponse,
  QueueDetailsResponse,
  ApiResponse,
  TxMonitorConfig,
  PollingOptions
} from './types';

export {
  TxMonitorError,
  TxMonitorTimeoutError,
  TxMonitorNotFoundError
} from './types';

export {
  isTransactionFinal,
  isTransactionSuccessful,
  isTransactionFailed,
  isTransactionPending,
  getStatusPriority,
  formatTransactionAge,
  validateTransactionId,
  normalizeTransactionId,
  createPollingProgressTracker,
  TransactionStatusTracker,
  createBatchProcessor
} from './utils';

export function createTxMonitorClient(config: TxMonitorConfig = {}): TxMonitorClient {
  return new TxMonitorClient(config);
}

export function createSimpleClient(): TxMonitorClient {
  return new TxMonitorClient();
}