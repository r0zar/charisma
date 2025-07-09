export type TransactionStatus = 'success' | 'abort_by_response' | 'abort_by_post_condition' | 'pending' | 'broadcasted' | 'not_found';

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

export interface MetricsSnapshot {
  timestamp: number;
  queueSize: number;
  processed: number;
  successful: number;
  failed: number;
  oldestTransactionAge?: number;
  processingHealth: 'healthy' | 'warning' | 'error';
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

export interface QueueDetailsResponse {
  queue: TransactionInfo[];
  total: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface TxMonitorConfig {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  adminAuth?: {
    token?: string;
    headers?: Record<string, string>;
  };
}

export interface PollingOptions {
  interval?: number;
  timeout?: number;
  maxAttempts?: number;
  onStatusChange?: (status: StatusResponse) => void;
  onError?: (error: Error) => void;
}

export class TxMonitorError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'TxMonitorError';
  }
}

export class TxMonitorTimeoutError extends TxMonitorError {
  constructor(message: string = 'Request timeout') {
    super(message, 408);
    this.name = 'TxMonitorTimeoutError';
  }
}

export class TxMonitorNotFoundError extends TxMonitorError {
  constructor(message: string = 'Transaction not found') {
    super(message, 404);
    this.name = 'TxMonitorNotFoundError';
  }
}