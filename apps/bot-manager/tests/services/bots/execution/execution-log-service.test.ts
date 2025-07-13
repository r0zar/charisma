/**
 * Unit tests for Execution Log Service
 * 
 * Tests Vercel Blob storage for execution logs, including storage, retrieval, deletion, and existence checks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ExecutionLogService, type LogMetadata } from '@/lib/services/bots/execution/execution-log-service';

// Mock Vercel Blob
vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn()
}));

// Mock fetch for retrieving logs
global.fetch = vi.fn();

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn()
}));

describe('Execution Log Service', () => {
  let mockPut: any;
  let mockDel: any;
  let mockFetch: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked functions
    mockPut = (await import('@vercel/blob')).put;
    mockDel = (await import('@vercel/blob')).del;
    mockFetch = global.fetch as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('store', () => {
    it('should store execution logs successfully', async () => {
      const mockBlob = {
        url: 'https://vercel-blob.store/executions/user-123/bot-456/exec-789.log',
        pathname: '/executions/user-123/bot-456/exec-789.log',
        downloadUrl: 'https://vercel-blob.store/executions/user-123/bot-456/exec-789.log'
      };

      mockPut.mockResolvedValue(mockBlob);

      const userId = 'user-123';
      const botId = 'bot-456';
      const executionId = 'exec-789';
      const logContent = 'Bot execution started\nTrading STX...\nExecution completed successfully';

      const result = await ExecutionLogService.store(userId, botId, executionId, logContent);

      expect(mockPut).toHaveBeenCalledWith(
        'executions/user-123/bot-456/exec-789.log',
        logContent,
        {
          access: 'public',
          contentType: 'text/plain'
        }
      );

      expect(result).toEqual({
        url: mockBlob.url,
        size: logContent.length,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
      });
    });

    it('should handle blob storage errors', async () => {
      mockPut.mockRejectedValue(new Error('Blob storage failed'));

      await expect(
        ExecutionLogService.store('user-123', 'bot-456', 'exec-789', 'log content')
      ).rejects.toThrow('Failed to store execution logs: Blob storage failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockPut.mockRejectedValue('String error');

      await expect(
        ExecutionLogService.store('user-123', 'bot-456', 'exec-789', 'log content')
      ).rejects.toThrow('Failed to store execution logs: String error');
    });

    it('should create correct filename format', async () => {
      const mockBlob = {
        url: 'https://vercel-blob.store/test.log',
        pathname: '/test.log'
      };

      mockPut.mockResolvedValue(mockBlob);

      await ExecutionLogService.store('user-abc', 'bot-xyz', 'exec-123', 'test logs');

      expect(mockPut).toHaveBeenCalledWith(
        'executions/user-abc/bot-xyz/exec-123.log',
        'test logs',
        expect.objectContaining({
          access: 'public',
          contentType: 'text/plain'
        })
      );
    });

    it('should handle empty log content', async () => {
      const mockBlob = {
        url: 'https://vercel-blob.store/empty.log',
        pathname: '/empty.log'
      };

      mockPut.mockResolvedValue(mockBlob);

      const result = await ExecutionLogService.store('user-123', 'bot-456', 'exec-789', '');

      expect(result.size).toBe(0);
      expect(mockPut).toHaveBeenCalledWith(
        'executions/user-123/bot-456/exec-789.log',
        '',
        expect.any(Object)
      );
    });

    it('should handle special characters in IDs', async () => {
      const mockBlob = {
        url: 'https://vercel-blob.store/special.log',
        pathname: '/special.log'
      };

      mockPut.mockResolvedValue(mockBlob);

      await ExecutionLogService.store(
        'user_with-special.chars',
        'SP1234567890ABCDEF1234567890ABCDEF12345678',
        'exec_2025-01-15_123',
        'test content'
      );

      expect(mockPut).toHaveBeenCalledWith(
        'executions/user_with-special.chars/SP1234567890ABCDEF1234567890ABCDEF12345678/exec_2025-01-15_123.log',
        'test content',
        expect.any(Object)
      );
    });
  });

  describe('retrieve', () => {
    it('should retrieve execution logs successfully', async () => {
      const logContent = 'Retrieved log content\nLine 2\nLine 3';
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(logContent)
      });

      const blobUrl = 'https://vercel-blob.store/executions/user-123/bot-456/exec-789.log';
      const result = await ExecutionLogService.retrieve(blobUrl);

      expect(mockFetch).toHaveBeenCalledWith(blobUrl);
      expect(result).toBe(logContent);
    });

    it('should handle fetch errors with status code', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const blobUrl = 'https://vercel-blob.store/nonexistent.log';

      await expect(
        ExecutionLogService.retrieve(blobUrl)
      ).rejects.toThrow('Failed to retrieve execution logs: Failed to fetch logs: 404 Not Found');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        ExecutionLogService.retrieve('https://vercel-blob.store/test.log')
      ).rejects.toThrow('Failed to retrieve execution logs: Network error');
    });

    it('should handle text parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockRejectedValue(new Error('Text parsing failed'))
      });

      await expect(
        ExecutionLogService.retrieve('https://vercel-blob.store/test.log')
      ).rejects.toThrow('Failed to retrieve execution logs: Text parsing failed');
    });

    it('should handle non-Error exceptions in fetch', async () => {
      mockFetch.mockRejectedValue('String fetch error');

      await expect(
        ExecutionLogService.retrieve('https://vercel-blob.store/test.log')
      ).rejects.toThrow('Failed to retrieve execution logs: String fetch error');
    });

    it('should retrieve empty log content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('')
      });

      const result = await ExecutionLogService.retrieve('https://vercel-blob.store/empty.log');
      expect(result).toBe('');
    });

    it('should handle large log content', async () => {
      const largeContent = 'A'.repeat(100000); // 100KB of content
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(largeContent)
      });

      const result = await ExecutionLogService.retrieve('https://vercel-blob.store/large.log');
      expect(result).toBe(largeContent);
      expect(result.length).toBe(100000);
    });
  });

  describe('delete', () => {
    it('should delete execution logs successfully', async () => {
      mockDel.mockResolvedValue(undefined);

      const blobUrl = 'https://vercel-blob.store/executions/user-123/bot-456/exec-789.log';
      const result = await ExecutionLogService.delete(blobUrl);

      expect(mockDel).toHaveBeenCalledWith('/executions/user-123/bot-456/exec-789.log');
      expect(result).toBe(true);
    });

    it('should handle deletion errors gracefully', async () => {
      mockDel.mockRejectedValue(new Error('Deletion failed'));

      const result = await ExecutionLogService.delete('https://vercel-blob.store/test.log');

      expect(result).toBe(false);
      expect(mockDel).toHaveBeenCalledWith('/test.log');
    });

    it('should handle invalid URLs gracefully', async () => {
      const result = await ExecutionLogService.delete('invalid-url');

      expect(result).toBe(false);
      expect(mockDel).not.toHaveBeenCalled();
    });

    it('should extract pathname correctly from complex URLs', async () => {
      mockDel.mockResolvedValue(undefined);

      const complexUrl = 'https://vercel-blob.store/subfolder/nested/path/file.log?param=value#fragment';
      const result = await ExecutionLogService.delete(complexUrl);

      expect(mockDel).toHaveBeenCalledWith('/subfolder/nested/path/file.log');
      expect(result).toBe(true);
    });

    it('should handle URLs with query parameters and fragments', async () => {
      mockDel.mockResolvedValue(undefined);

      const urlWithParams = 'https://vercel-blob.store/executions/user/bot/exec.log?download=true&format=text#section1';
      const result = await ExecutionLogService.delete(urlWithParams);

      expect(mockDel).toHaveBeenCalledWith('/executions/user/bot/exec.log');
      expect(result).toBe(true);
    });

    it('should handle deletion of root path', async () => {
      mockDel.mockResolvedValue(undefined);

      const rootUrl = 'https://vercel-blob.store/file.log';
      const result = await ExecutionLogService.delete(rootUrl);

      expect(mockDel).toHaveBeenCalledWith('/file.log');
      expect(result).toBe(true);
    });

    it('should handle non-Error exceptions in deletion', async () => {
      mockDel.mockRejectedValue('String deletion error');

      const result = await ExecutionLogService.delete('https://vercel-blob.store/test.log');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing logs', async () => {
      mockFetch.mockResolvedValue({
        ok: true
      });

      const blobUrl = 'https://vercel-blob.store/executions/user-123/bot-456/exec-789.log';
      const result = await ExecutionLogService.exists(blobUrl);

      expect(mockFetch).toHaveBeenCalledWith(blobUrl, { method: 'HEAD' });
      expect(result).toBe(true);
    });

    it('should return false for non-existing logs', async () => {
      mockFetch.mockResolvedValue({
        ok: false
      });

      const blobUrl = 'https://vercel-blob.store/nonexistent.log';
      const result = await ExecutionLogService.exists(blobUrl);

      expect(mockFetch).toHaveBeenCalledWith(blobUrl, { method: 'HEAD' });
      expect(result).toBe(false);
    });

    it('should return false on network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await ExecutionLogService.exists('https://vercel-blob.store/test.log');

      expect(result).toBe(false);
    });

    it('should return false on fetch exceptions', async () => {
      mockFetch.mockRejectedValue('Any fetch error');

      const result = await ExecutionLogService.exists('https://vercel-blob.store/test.log');

      expect(result).toBe(false);
    });

    it('should handle invalid URLs', async () => {
      mockFetch.mockRejectedValue(new TypeError('Invalid URL'));

      const result = await ExecutionLogService.exists('invalid-url');

      expect(result).toBe(false);
    });

    it('should handle HEAD request timeout', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));

      const result = await ExecutionLogService.exists('https://vercel-blob.store/slow.log');

      expect(result).toBe(false);
    });

    it('should use HEAD method for efficiency', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await ExecutionLogService.exists('https://vercel-blob.store/test.log');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://vercel-blob.store/test.log',
        { method: 'HEAD' }
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete log lifecycle', async () => {
      const userId = 'user-123';
      const botId = 'bot-456';
      const executionId = 'exec-789';
      const logContent = 'Complete execution log';

      // 1. Store logs
      const mockBlob = {
        url: 'https://vercel-blob.store/executions/user-123/bot-456/exec-789.log'
      };
      mockPut.mockResolvedValue(mockBlob);

      const storeResult = await ExecutionLogService.store(userId, botId, executionId, logContent);
      expect(storeResult.url).toBe(mockBlob.url);

      // 2. Check existence
      mockFetch.mockResolvedValueOnce({ ok: true });
      const exists = await ExecutionLogService.exists(storeResult.url);
      expect(exists).toBe(true);

      // 3. Retrieve logs
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(logContent)
      });
      const retrievedContent = await ExecutionLogService.retrieve(storeResult.url);
      expect(retrievedContent).toBe(logContent);

      // 4. Delete logs
      mockDel.mockResolvedValue(undefined);
      const deleteResult = await ExecutionLogService.delete(storeResult.url);
      expect(deleteResult).toBe(true);
    });

    it('should handle concurrent operations gracefully', async () => {
      const logContent = 'Concurrent test log';
      
      const mockBlob = {
        url: 'https://vercel-blob.store/concurrent.log'
      };
      mockPut.mockResolvedValue(mockBlob);
      mockFetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(logContent)
      });

      // Simulate concurrent store and retrieve operations
      const storePromise = ExecutionLogService.store('user1', 'bot1', 'exec1', logContent);
      const retrievePromise = ExecutionLogService.retrieve(mockBlob.url);

      const [storeResult, retrievedContent] = await Promise.all([storePromise, retrievePromise]);

      expect(storeResult.url).toBe(mockBlob.url);
      expect(retrievedContent).toBe(logContent);
    });

    it('should handle edge case with very long IDs', async () => {
      const longUserId = 'user-' + 'a'.repeat(100);
      const longBotId = 'bot-' + 'b'.repeat(100);
      const longExecutionId = 'exec-' + 'c'.repeat(100);

      const mockBlob = { url: 'https://vercel-blob.store/long.log' };
      mockPut.mockResolvedValue(mockBlob);

      const result = await ExecutionLogService.store(longUserId, longBotId, longExecutionId, 'test');

      expect(mockPut).toHaveBeenCalledWith(
        `executions/${longUserId}/${longBotId}/${longExecutionId}.log`,
        'test',
        expect.any(Object)
      );
      expect(result.url).toBe(mockBlob.url);
    });

    it('should handle logs with special content', async () => {
      const specialContent = 'Logs with special chars: 中文 🚀 \n\t\r\0\x01 and unicode: ñáéíóú';
      
      const mockBlob = { url: 'https://vercel-blob.store/special.log' };
      mockPut.mockResolvedValue(mockBlob);

      const result = await ExecutionLogService.store('user-123', 'bot-456', 'exec-789', specialContent);

      expect(mockPut).toHaveBeenCalledWith(
        'executions/user-123/bot-456/exec-789.log',
        specialContent,
        expect.objectContaining({
          contentType: 'text/plain'
        })
      );
      expect(result.size).toBe(specialContent.length);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed blob responses', async () => {
      mockPut.mockResolvedValue(null);

      await expect(
        ExecutionLogService.store('user-123', 'bot-456', 'exec-789', 'test')
      ).rejects.toThrow('Failed to store execution logs');
    });

    it('should handle fetch response without text method', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: undefined
      });

      await expect(
        ExecutionLogService.retrieve('https://vercel-blob.store/test.log')
      ).rejects.toThrow('Failed to retrieve execution logs');
    });

    it('should handle URL constructor errors in delete', async () => {
      // Mock URL constructor to throw
      const originalURL = global.URL;
      global.URL = vi.fn().mockImplementation(() => {
        throw new Error('Invalid URL');
      }) as any;

      const result = await ExecutionLogService.delete('invalid-url');
      expect(result).toBe(false);

      // Restore URL constructor
      global.URL = originalURL;
    });

    it('should handle very large log content storage', async () => {
      const veryLargeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      
      const mockBlob = { url: 'https://vercel-blob.store/large.log' };
      mockPut.mockResolvedValue(mockBlob);

      const result = await ExecutionLogService.store('user-123', 'bot-456', 'exec-789', veryLargeContent);

      expect(result.size).toBe(veryLargeContent.length);
      expect(mockPut).toHaveBeenCalledWith(
        expect.any(String),
        veryLargeContent,
        expect.any(Object)
      );
    });

    it('should handle blob storage quota exceeded', async () => {
      mockPut.mockRejectedValue(new Error('Storage quota exceeded'));

      await expect(
        ExecutionLogService.store('user-123', 'bot-456', 'exec-789', 'test')
      ).rejects.toThrow('Failed to store execution logs: Storage quota exceeded');
    });

    it('should handle network timeouts in retrieval', async () => {
      mockFetch.mockRejectedValue(new Error('ETIMEDOUT'));

      await expect(
        ExecutionLogService.retrieve('https://vercel-blob.store/test.log')
      ).rejects.toThrow('Failed to retrieve execution logs: ETIMEDOUT');
    });
  });
});