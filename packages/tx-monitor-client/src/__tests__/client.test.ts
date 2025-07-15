import { describe, it, expect, beforeEach, jest } from 'vitest';
import { TxMonitorClient } from '../client';
import { TxMonitorError, TxMonitorNotFoundError, TxMonitorTimeoutError } from '../types';

// Mock fetch globally
const mockFetch = vi.fn() as vi.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('TxMonitorClient', () => {
  let client: TxMonitorClient;
  const baseUrl = 'https://api.example.com';

  beforeEach(() => {
    client = new TxMonitorClient({ baseUrl });
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultClient = new TxMonitorClient();
      expect(defaultClient).toBeInstanceOf(TxMonitorClient);
    });

    it('should use default baseUrl when not provided', () => {
      const defaultClient = new TxMonitorClient();
      expect(defaultClient).toBeInstanceOf(TxMonitorClient);
    });

    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new TxMonitorClient({ baseUrl: 'https://api.example.com/' });
      expect(clientWithSlash).toBeInstanceOf(TxMonitorClient);
    });

    it('should use custom config values', () => {
      const customClient = new TxMonitorClient({
        baseUrl,
        timeout: 60000,
        retryAttempts: 5,
        retryDelay: 2000
      });
      expect(customClient).toBeInstanceOf(TxMonitorClient);
    });
  });

  describe('addToQueue', () => {
    it('should add transactions to queue successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          added: ['tx1', 'tx2'],
          alreadyMonitored: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.addToQueue(['tx1', 'tx2']);

      expect(result).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/queue/add`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ txids: ['tx1', 'tx2'] })
        })
      );
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        success: false,
        error: 'Invalid txids'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockResponse
      } as Response);

      await expect(client.addToQueue(['invalid'])).rejects.toThrow(TxMonitorError);
    });
  });

  describe('getTransactionStatus', () => {
    it('should get transaction status successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          txid: 'tx1',
          status: 'success' as const,
          blockHeight: 123456,
          blockTime: 1234567890,
          fromCache: false,
          checkedAt: Date.now()
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.getTransactionStatus('tx1');

      expect(result).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/status/tx1`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle 404 errors with TxMonitorNotFoundError', async () => {
      const mockResponse = {
        success: false,
        error: 'Transaction not found'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => mockResponse
      } as Response);

      await expect(client.getTransactionStatus('nonexistent')).rejects.toThrow(TxMonitorNotFoundError);
    });
  });

  describe('getQueueStats', () => {
    it('should get queue statistics successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          queueSize: 10,
          oldestTransaction: 'tx1',
          oldestTransactionAge: 3600000,
          processingHealth: 'healthy' as const,
          totalProcessed: 100,
          totalFailed: 5,
          totalSuccessful: 95
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.getQueueStats();

      expect(result).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/queue/stats`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });
  });

  describe('pollTransactionStatus', () => {
    it('should poll until transaction is final', async () => {
      const pendingResponse = {
        success: true,
        data: {
          txid: 'tx1',
          status: 'pending' as const,
          fromCache: false,
          checkedAt: Date.now()
        }
      };

      const successResponse = {
        success: true,
        data: {
          txid: 'tx1',
          status: 'success' as const,
          blockHeight: 123456,
          blockTime: 1234567890,
          fromCache: false,
          checkedAt: Date.now()
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pendingResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => successResponse
        } as Response);

      const result = await client.pollTransactionStatus('tx1', {
        interval: 100,
        timeout: 5000
      });

      expect(result).toEqual(successResponse.data);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle not found as final status', async () => {
      mockFetch.mockRejectedValueOnce(new TxMonitorNotFoundError('Transaction not found'));

      const result = await client.pollTransactionStatus('nonexistent', {
        interval: 100,
        timeout: 5000
      });

      expect(result.status).toBe('not_found');
      expect(result.txid).toBe('nonexistent');
    }, 10000);
  });

  describe('batchAddToQueue', () => {
    it('should process transactions in batches', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          added: ['tx1', 'tx2'],
          alreadyMonitored: []
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const txids = ['tx1', 'tx2', 'tx3', 'tx4', 'tx5'];
      const results = await client.batchAddToQueue(txids, 2);

      expect(results).toHaveLength(3); // 5 txids with batch size 2 = 3 batches
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('isHealthy', () => {
    it('should return true when all systems are healthy', async () => {
      const mockResponse = {
        success: true,
        data: {
          cron: 'healthy' as const,
          api: 'healthy' as const,
          queue: 'healthy' as const,
          kvConnectivity: true,
          uptime: 123456
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.isHealthy();

      expect(result).toBe(true);
    });

    it('should return false when systems are unhealthy', async () => {
      const mockResponse = {
        success: true,
        data: {
          cron: 'error' as const,
          api: 'healthy' as const,
          queue: 'healthy' as const,
          kvConnectivity: false,
          uptime: 123456
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await client.isHealthy();

      expect(result).toBe(false);
    });

    it('should return false when health check fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('Activity Integration Methods', () => {
    describe('addToQueueWithMapping', () => {
      it('should add transactions with activity mapping successfully', async () => {
        const mockResponse = {
          success: true,
          data: {
            success: true,
            added: ['tx1', 'tx2'],
            alreadyMonitored: [],
            mappingsStored: 2
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response);

        const transactions = [
          { txid: 'tx1', recordId: 'order-1', recordType: 'order' as const },
          { txid: 'tx2', recordId: 'swap-1', recordType: 'swap' as const }
        ];

        const result = await client.addToQueueWithMapping(transactions);

        expect(result).toEqual(mockResponse.data);
        expect(mockFetch).toHaveBeenCalledWith(
          `${baseUrl}/api/v1/queue/add-with-mapping`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: JSON.stringify({ transactions })
          })
        );
      });

      it('should handle empty transactions array', async () => {
        const mockResponse = {
          success: true,
          data: {
            success: true,
            added: [],
            alreadyMonitored: [],
            mappingsStored: 0
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response);

        const result = await client.addToQueueWithMapping([]);

        expect(result).toEqual(mockResponse.data);
      });

      it('should handle API errors', async () => {
        const mockResponse = {
          success: false,
          error: 'Invalid record type'
        };

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => mockResponse
        } as Response);

        const transactions = [
          { txid: 'tx1', recordId: 'order-1', recordType: 'invalid' as any }
        ];

        await expect(client.addToQueueWithMapping(transactions)).rejects.toThrow(TxMonitorError);
      });
    });

    describe('addTransactionWithMapping', () => {
      it('should add single transaction with mapping successfully', async () => {
        const mockResponse = {
          success: true,
          data: {
            success: true,
            added: ['tx1'],
            alreadyMonitored: [],
            mappingsStored: 1
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response);

        const result = await client.addTransactionWithMapping('tx1', 'order-1', 'order');

        expect(result).toEqual(mockResponse.data);
        expect(mockFetch).toHaveBeenCalledWith(
          `${baseUrl}/api/v1/queue/add-with-mapping`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: JSON.stringify({ 
              transactions: [{ txid: 'tx1', recordId: 'order-1', recordType: 'order' }]
            })
          })
        );
      });

      it('should handle already monitored transactions', async () => {
        const mockResponse = {
          success: true,
          data: {
            success: true,
            added: [],
            alreadyMonitored: ['tx1'],
            mappingsStored: 1
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response);

        const result = await client.addTransactionWithMapping('tx1', 'swap-1', 'swap');

        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('batchAddToQueueWithMapping', () => {
      it('should process transactions with mappings in batches', async () => {
        const mockResponse = {
          success: true,
          data: {
            success: true,
            added: ['tx1', 'tx2'],
            alreadyMonitored: [],
            mappingsStored: 2
          }
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => mockResponse
        } as Response);

        const transactions = [
          { txid: 'tx1', recordId: 'order-1', recordType: 'order' as const },
          { txid: 'tx2', recordId: 'order-2', recordType: 'order' as const },
          { txid: 'tx3', recordId: 'swap-1', recordType: 'swap' as const },
          { txid: 'tx4', recordId: 'swap-2', recordType: 'swap' as const },
          { txid: 'tx5', recordId: 'order-3', recordType: 'order' as const }
        ];

        const results = await client.batchAddToQueueWithMapping(transactions, 2);

        expect(results).toHaveLength(3); // 5 transactions with batch size 2 = 3 batches
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });

      it('should handle batch processing errors', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              data: { success: true, added: ['tx1'], alreadyMonitored: [], mappingsStored: 1 }
            })
          } as Response)
          .mockRejectedValueOnce(new Error('Network error'));

        const transactions = [
          { txid: 'tx1', recordId: 'order-1', recordType: 'order' as const },
          { txid: 'tx2', recordId: 'order-2', recordType: 'order' as const }
        ];

        await expect(client.batchAddToQueueWithMapping(transactions, 1)).rejects.toThrow(TxMonitorError);
      });
    });
  });
});