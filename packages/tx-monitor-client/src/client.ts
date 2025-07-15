import type {
  TxMonitorConfig,
  QueueAddRequest,
  QueueAddResponse,
  StatusResponse,
  QueueStatsResponse,
  QueueDetailsResponse,
  MetricsHistoryResponse,
  HealthCheckResponse,
  CronMonitorResult,
  ApiResponse,
  PollingOptions,
  TransactionRegistration,
  QueueAddWithMappingRequest,
  QueueAddWithMappingResponse
} from './types';

import {
  TxMonitorError,
  TxMonitorTimeoutError,
  TxMonitorNotFoundError
} from './types';

export class TxMonitorClient {
  private config: Required<Omit<TxMonitorConfig, 'adminAuth'>> & { adminAuth?: TxMonitorConfig['adminAuth'] };

  constructor(config: TxMonitorConfig = {}) {
    this.config = {
      baseUrl: (process.env.NEXT_PUBLIC_TX_MONITOR_URL || 'http://localhost:3012').replace(/\/$/, ''),
      timeout: config.timeout ?? 30000,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      adminAuth: config.adminAuth
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isAdmin: boolean = false
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (isAdmin && this.config.adminAuth) {
      if (this.config.adminAuth.token) {
        headers['Authorization'] = `Bearer ${this.config.adminAuth.token}`;
      }
      if (this.config.adminAuth.headers) {
        Object.assign(headers, this.config.adminAuth.headers);
      }
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: controller.signal
    };

    try {
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 404) {
          throw new TxMonitorNotFoundError(errorData.message || 'Not found');
        }

        throw new TxMonitorError(
          errorData.message || errorData.error || `Request failed with status ${response.status}`,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof TxMonitorError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TxMonitorTimeoutError();
      }

      throw new TxMonitorError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    isAdmin: boolean = false
  ): Promise<ApiResponse<T>> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.request<T>(endpoint, options, isAdmin);
      } catch (error) {
        lastError = error as Error;

        if (error instanceof TxMonitorNotFoundError ||
          (error instanceof TxMonitorError && error.status && error.status >= 400 && error.status < 500)) {
          throw error;
        }

        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError!;
  }

  async addToQueue(txids: string[]): Promise<QueueAddResponse> {
    const response = await this.requestWithRetry<QueueAddResponse>(
      '/api/v1/queue/add',
      {
        method: 'POST',
        body: JSON.stringify({ txids } as QueueAddRequest)
      }
    );

    if (!response.success || !response.data) {
      throw new TxMonitorError(response.error || 'Failed to add transactions to queue');
    }

    return response.data;
  }

  async addToQueueWithMapping(transactions: TransactionRegistration[]): Promise<QueueAddWithMappingResponse> {
    const response = await this.requestWithRetry<QueueAddWithMappingResponse>(
      '/api/v1/queue/add-with-mapping',
      {
        method: 'POST',
        body: JSON.stringify({ transactions } as QueueAddWithMappingRequest)
      }
    );

    if (!response.success || !response.data) {
      throw new TxMonitorError(response.error || 'Failed to add transactions to queue with mapping');
    }

    return response.data;
  }

  async addTransactionWithMapping(
    txid: string,
    recordId: string,
    recordType: 'order' | 'swap'
  ): Promise<QueueAddWithMappingResponse> {
    const transactions: TransactionRegistration[] = [{
      txid,
      recordId,
      recordType
    }];

    return await this.addToQueueWithMapping(transactions);
  }

  async getTransactionStatus(txid: string): Promise<StatusResponse> {
    const response = await this.requestWithRetry<StatusResponse>(
      `/api/v1/status/${encodeURIComponent(txid)}`
    );

    if (!response.success || !response.data) {
      throw new TxMonitorError(response.error || 'Failed to get transaction status');
    }

    return response.data;
  }

  async getQueueStats(): Promise<QueueStatsResponse> {
    const response = await this.requestWithRetry<QueueStatsResponse>(
      '/api/v1/queue/stats'
    );

    if (!response.success || !response.data) {
      throw new TxMonitorError(response.error || 'Failed to get queue statistics');
    }

    return response.data;
  }

  async getQueueDetails(): Promise<QueueDetailsResponse> {
    const response = await this.requestWithRetry<QueueDetailsResponse>(
      '/api/v1/admin/queue',
      {},
      true
    );

    if (!response.success || !response.data) {
      throw new TxMonitorError(response.error || 'Failed to get queue details');
    }

    return response.data;
  }

  async triggerCronJob(): Promise<CronMonitorResult> {
    const response = await this.requestWithRetry<CronMonitorResult>(
      '/api/v1/admin/trigger',
      { method: 'POST' },
      true
    );

    if (!response.success || !response.data) {
      throw new TxMonitorError(response.error || 'Failed to trigger cron job');
    }

    return response.data;
  }

  async getMetricsHistory(period: string = '1h'): Promise<MetricsHistoryResponse> {
    const response = await this.requestWithRetry<MetricsHistoryResponse>(
      `/api/v1/metrics/history?period=${encodeURIComponent(period)}`
    );

    if (!response.success || !response.data) {
      throw new TxMonitorError(response.error || 'Failed to get metrics history');
    }

    return response.data;
  }

  async getHealthCheck(): Promise<HealthCheckResponse> {
    const response = await this.requestWithRetry<HealthCheckResponse>(
      '/api/v1/health'
    );

    if (!response.success || !response.data) {
      throw new TxMonitorError(response.error || 'Failed to get health check');
    }

    return response.data;
  }

  async pollTransactionStatus(
    txid: string,
    options: PollingOptions = {}
  ): Promise<StatusResponse> {
    const {
      interval = 5000,
      timeout = 300000,
      maxAttempts = 60,
      onStatusChange,
      onError
    } = options;

    const startTime = Date.now();
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          const status = await this.getTransactionStatus(txid);

          if (onStatusChange) {
            onStatusChange(status);
          }

          if (status.status !== 'pending' && status.status !== 'broadcasted') {
            resolve(status);
            return;
          }

          if (attempts >= maxAttempts) {
            reject(new TxMonitorError(`Maximum polling attempts (${maxAttempts}) reached`));
            return;
          }

          if (Date.now() - startTime >= timeout) {
            reject(new TxMonitorTimeoutError('Polling timeout reached'));
            return;
          }

          setTimeout(poll, interval);
        } catch (error) {
          if (onError) {
            onError(error as Error);
          }

          if (error instanceof TxMonitorNotFoundError) {
            resolve({
              txid,
              status: 'not_found',
              fromCache: false,
              checkedAt: Date.now()
            });
            return;
          }

          if (attempts >= maxAttempts) {
            reject(error);
            return;
          }

          setTimeout(poll, interval);
        }
      };

      poll();
    });
  }

  async batchAddToQueue(txids: string[], batchSize: number = 10): Promise<QueueAddResponse[]> {
    const batches: string[][] = [];

    for (let i = 0; i < txids.length; i += batchSize) {
      batches.push(txids.slice(i, i + batchSize));
    }

    const results = await Promise.allSettled(
      batches.map(batch => this.addToQueue(batch))
    );

    const responses: QueueAddResponse[] = [];
    const errors: Error[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        responses.push(result.value);
      } else {
        errors.push(result.reason);
      }
    }

    if (errors.length > 0) {
      throw new TxMonitorError(
        `Batch operation failed: ${errors.map(e => e.message).join(', ')}`,
        undefined,
        { errors }
      );
    }

    return responses;
  }

  async batchAddToQueueWithMapping(
    transactions: TransactionRegistration[],
    batchSize: number = 10
  ): Promise<QueueAddWithMappingResponse[]> {
    const batches: TransactionRegistration[][] = [];

    for (let i = 0; i < transactions.length; i += batchSize) {
      batches.push(transactions.slice(i, i + batchSize));
    }

    const results = await Promise.allSettled(
      batches.map(batch => this.addToQueueWithMapping(batch))
    );

    const responses: QueueAddWithMappingResponse[] = [];
    const errors: Error[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        responses.push(result.value);
      } else {
        errors.push(result.reason);
      }
    }

    if (errors.length > 0) {
      throw new TxMonitorError(
        `Batch operation with mapping failed: ${errors.map(e => e.message).join(', ')}`,
        undefined,
        { errors }
      );
    }

    return responses;
  }

  async waitForTransaction(
    txid: string,
    options: PollingOptions = {}
  ): Promise<StatusResponse> {
    return this.pollTransactionStatus(txid, options);
  }

  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.getHealthCheck();
      return health.cron === 'healthy' &&
        health.api === 'healthy' &&
        health.queue === 'healthy' &&
        health.kvConnectivity;
    } catch {
      return false;
    }
  }
}