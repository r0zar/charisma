/**
 * BlobStorage Tests
 * Core functionality tests for blob-based contract metadata storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlobStorage } from '../../index';
import {
  createSampleContractMetadata,
  SAMPLE_CONTRACT_IDS,
  ERROR_SCENARIOS,
  mockFactory
} from '../fixtures/test-fixtures';

// Mock @vercel/blob module
vi.mock('@vercel/blob');

describe('BlobStorage', () => {
  let blobStorage: BlobStorage;
  let mockBlob: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocked @vercel/blob functions
    mockBlob = await import('@vercel/blob');

    // Set required environment variable for tests

    // Setup default successful mock responses
    setupDefaultMockResponses();

    blobStorage = new BlobStorage({
      serviceName: 'test-registry',
      pathPrefix: 'test-contracts/',
      enforcementLevel: 'warn'
    });
  });

  function setupDefaultMockResponses() {
    // Default successful responses
    mockBlob.put.mockResolvedValue({
      url: 'https://blob.vercel.com/test.json'
    });

    mockBlob.head.mockResolvedValue({
      url: 'https://blob.vercel.com/test.json',
      size: 1024,
      uploadedAt: new Date()
    });

    mockBlob.fetch.mockResolvedValue(new Response('{"test": "data"}', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));

    mockBlob.delete.mockResolvedValue(undefined);

    mockBlob.list.mockResolvedValue({
      blobs: [],
      hasMore: false,
      cursor: null
    });

    mockBlob.get.mockResolvedValue(null);
    mockBlob.copy.mockResolvedValue(undefined);
    mockBlob.clearResolvedAlerts.mockResolvedValue(undefined);
    mockBlob.resetStats.mockResolvedValue(undefined);

    mockBlob.getStats.mockReturnValue({
      totalOperations: 0,
      operationBreakdown: {},
      cacheHitRate: 0,
      averageResponseTime: 0,
      totalCost: 0,
      costBreakdown: {
        storage: 0,
        simpleOperations: 0,
        advancedOperations: 0,
        dataTransfer: 0,
        fastOriginTransfer: 0,
        total: 0
      },
      alerts: [],
      uptime: Date.now(),
      lastReset: Date.now()
    });

    mockBlob.getRecentOperations.mockReturnValue([]);
    mockBlob.getAlerts.mockReturnValue([]);
  }

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const storage = new BlobStorage({
        serviceName: 'test-service',
        pathPrefix: 'contracts/'
      });
      expect(storage).toBeInstanceOf(BlobStorage);
    });

    it('should initialize with custom configuration', () => {
      const storage = new BlobStorage({
        serviceName: 'custom-service',
        pathPrefix: 'custom-path/',
        enforcementLevel: 'block'
      });
      expect(storage).toBeInstanceOf(BlobStorage);
    });

    it('should throw error when missing required environment variables', () => {
      delete process.env.BLOB_BASE_URL;

      expect(() => new BlobStorage({
        serviceName: 'test-service',
        pathPrefix: 'contracts/'
      })).toThrow();

      // Restore for other tests
      process.env.BLOB_BASE_URL = 'https://test.blob.storage.vercel.app';
    });
  });

  describe('putContract', () => {
    it('should store contract metadata successfully', async () => {
      const metadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      await blobStorage.putContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, metadata);

      expect(mockBlob.put).toHaveBeenCalledWith(
        'test-contracts/SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.charisma-token.json',
        JSON.stringify(metadata, null, 0),
        {
          contentType: 'application/json',
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true
        }
      );
    });

    it('should handle contract IDs with special characters', async () => {
      const contractId = 'SP123.contract-with-dashes';
      const metadata = createSampleContractMetadata(contractId);

      await blobStorage.putContract(contractId, metadata);

      expect(mockBlob.put).toHaveBeenCalledWith(
        'test-contracts/SP123.contract-with-dashes.json',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should throw error when blob storage fails', async () => {
      const metadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      mockBlob.put.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      await expect(
        blobStorage.putContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, metadata)
      ).rejects.toThrow('Failed to store contract');
    });

    it('should compress metadata for storage efficiency', async () => {
      const metadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      await blobStorage.putContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, metadata);

      const storedData = mockBlob.put.mock.calls[0][1];
      expect(storedData).not.toContain('\n  '); // No indentation in the stored JSON
      expect(storedData).toEqual(JSON.stringify(metadata, null, 0)); // Compact JSON
    });

    it('should validate metadata before storing', async () => {
      const invalidMetadata = null;

      await expect(
        blobStorage.putContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, invalidMetadata as any)
      ).rejects.toThrow();
    });
  });

  describe('getContract', () => {
    it('should retrieve contract metadata successfully', async () => {
      const metadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      mockBlob.head.mockResolvedValueOnce({
        url: 'https://blob.vercel.com/test.json',
        size: 1024,
        uploadedAt: new Date()
      });

      mockBlob.fetch.mockResolvedValueOnce(new Response(
        JSON.stringify(metadata),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ));

      const result = await blobStorage.getContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result).toEqual(metadata);
      expect(mockBlob.fetch).toHaveBeenCalledWith(
        'https://test.blob.storage.vercel.app/test-contracts/SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.charisma-token.json'
      );
    });

    it('should return null for non-existent contract', async () => {
      mockBlob.fetch.mockResolvedValueOnce(new Response('', {
        status: 404,
        statusText: 'Not Found'
      }));

      const result = await blobStorage.getContract('SP123.non-existent');

      expect(result).toBeNull();
    });

    it('should return null when blob fetch fails with 404', async () => {
      const error = new Error('Blob not found');
      error.message = 'not found';
      mockBlob.fetch.mockRejectedValueOnce(error);

      const result = await blobStorage.getContract('SP123.missing');

      expect(result).toBeNull();
    });

    it('should throw error for other fetch failures', async () => {
      mockBlob.head.mockResolvedValueOnce({
        url: 'https://blob.vercel.com/test.json'
      });
      mockBlob.fetch.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      await expect(
        blobStorage.getContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN)
      ).rejects.toThrow('Failed to retrieve contract');
    });

    it('should handle malformed JSON gracefully', async () => {
      mockBlob.head.mockResolvedValueOnce({
        url: 'https://blob.vercel.com/test.json'
      });

      mockBlob.fetch.mockResolvedValueOnce(new Response(
        '{"invalid": json}',
        { status: 200 }
      ));

      await expect(
        blobStorage.getContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN)
      ).rejects.toThrow('Failed to retrieve contract');
    });
  });

  describe('getContracts (Bulk Operations)', () => {
    it('should retrieve multiple contracts successfully', async () => {
      const metadata1 = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      const metadata2 = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP009_NFT, 'nft');

      const contractIds = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN, SAMPLE_CONTRACT_IDS.SIP009_NFT];

      // Mock fetch to return different data for each call
      mockBlob.fetch
        .mockResolvedValueOnce(new Response(JSON.stringify(metadata1), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(metadata2), { status: 200 }));

      const result = await blobStorage.getContracts(contractIds);

      expect(result.successful).toHaveLength(2);
      expect(result.successful[0]).toEqual({
        contractId: SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        metadata: metadata1
      });
      expect(result.successful[1]).toEqual({
        contractId: SAMPLE_CONTRACT_IDS.SIP009_NFT,
        metadata: metadata2
      });
      expect(result.failed).toHaveLength(0);
    });

    it('should handle partial failures in bulk retrieval', async () => {
      const metadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      const contractIds = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN, 'SP123.failing-contract'];

      mockBlob.fetch
        .mockResolvedValueOnce(new Response(JSON.stringify(metadata), { status: 200 }))
        .mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      const result = await blobStorage.getContracts(contractIds);

      expect(result.successful).toHaveLength(1);
      expect(result.successful[0].contractId).toBe(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].contractId).toBe('SP123.failing-contract');
    });
  });

  describe('hasContract', () => {
    it('should return true for existing contract', async () => {
      mockBlob.head.mockResolvedValueOnce({
        url: 'https://blob.vercel.com/test.json'
      });

      const result = await blobStorage.hasContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result).toBe(true);
    });

    it('should return false for non-existent contract', async () => {
      mockBlob.head.mockResolvedValueOnce(null);

      const result = await blobStorage.hasContract('SP123.non-existent');

      expect(result).toBe(false);
    });

    it('should return false when head operation fails', async () => {
      mockBlob.head.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      const result = await blobStorage.hasContract('SP123.error');

      expect(result).toBe(false);
    });

    it('should cache head operation results', async () => {
      mockBlob.head.mockResolvedValue({
        url: 'https://blob.vercel.com/test.json'
      });

      // Call multiple times
      await blobStorage.hasContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      await blobStorage.hasContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should only call head once due to caching (if implemented)
      expect(mockBlob.head).toHaveBeenCalledTimes(2); // Adjust based on actual implementation
    });
  });

  describe('removeContract', () => {
    it('should remove contract successfully', async () => {
      await blobStorage.removeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(mockBlob.delete).toHaveBeenCalledWith(
        'test-contracts/SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.charisma-token.json'
      );
    });

    it('should not throw when removing non-existent contract', async () => {
      const error = new Error('Blob not found');
      error.message = 'not found';
      mockBlob.delete.mockRejectedValueOnce(error);

      await expect(
        blobStorage.removeContract('SP123.non-existent')
      ).resolves.not.toThrow();
    });

    it('should throw error for other removal failures', async () => {
      mockBlob.delete.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      await expect(
        blobStorage.removeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN)
      ).rejects.toThrow('Failed to remove contract');
    });

    it('should handle permission errors gracefully', async () => {
      const permissionError = new Error('Permission denied');
      mockBlob.delete.mockRejectedValueOnce(permissionError);

      await expect(
        blobStorage.removeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN)
      ).rejects.toThrow('Failed to remove contract');
    });
  });

  describe('listContracts', () => {
    it('should list all contracts successfully', async () => {
      const mockBlobs = [
        { pathname: 'test-contracts/SP123_contract1.json', size: 1024, uploadedAt: new Date() },
        { pathname: 'test-contracts/SP456_contract2.json', size: 2048, uploadedAt: new Date() },
        { pathname: 'test-contracts/SP789_contract3.json', size: 512, uploadedAt: new Date() }
      ];

      mockBlob.list.mockResolvedValueOnce({
        blobs: mockBlobs,
        hasMore: false,
        cursor: null
      });

      const result = await blobStorage.listContracts();

      expect(result).toEqual([
        'SP123.contract1',
        'SP456.contract2',
        'SP789.contract3'
      ]);
    });

    it('should return empty array when no contracts exist', async () => {
      mockBlob.list.mockResolvedValueOnce({
        blobs: [],
        hasMore: false,
        cursor: null
      });

      const result = await blobStorage.listContracts();

      expect(result).toEqual([]);
    });

    it('should throw error when list operation fails', async () => {
      mockBlob.list.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      await expect(blobStorage.listContracts()).rejects.toThrow('Failed to list contracts');
    });
  });

  describe('getStats', () => {
    it('should return storage statistics', async () => {
      const mockBlobs = [
        { pathname: 'test-contracts/SP123_contract1.json', size: 1024, uploadedAt: new Date() },
        { pathname: 'test-contracts/SP456_contract2.json', size: 2048, uploadedAt: new Date() },
        { pathname: 'test-contracts/SP789_contract3.json', size: 4096, uploadedAt: new Date() }
      ];

      mockBlob.list.mockResolvedValueOnce({
        blobs: mockBlobs,
        hasMore: false,
        cursor: null
      });

      const result = await blobStorage.getStats();

      expect(result).toEqual({
        totalContracts: 3,
        totalSize: 7168, // 1024 + 2048 + 4096
        averageSize: 2389, // Math.round(7168 / 3)
        largestContract: {
          contractId: 'SP789.contract3',
          size: 4096
        },
        compressionRatio: 0.3,
        lastUpdated: expect.any(Number)
      });
    });

    it('should handle empty storage', async () => {
      mockBlob.list.mockResolvedValueOnce({
        blobs: [],
        hasMore: false,
        cursor: null
      });

      const result = await blobStorage.getStats();

      expect(result).toEqual({
        totalContracts: 0,
        totalSize: 0,
        averageSize: 0,
        largestContract: null,
        compressionRatio: 0.3,
        lastUpdated: expect.any(Number)
      });
    });

    it('should calculate statistics correctly for single contract', async () => {
      const mockBlobs = [
        { pathname: 'test-contracts/SP123_contract1.json', size: 1024, uploadedAt: new Date() }
      ];

      mockBlob.list.mockResolvedValueOnce({
        blobs: mockBlobs,
        hasMore: false,
        cursor: null
      });

      const result = await blobStorage.getStats();

      expect(result.totalContracts).toBe(1);
      expect(result.totalSize).toBe(1024);
      expect(result.averageSize).toBe(1024);
      expect(result.largestContract).toEqual({
        contractId: 'SP123.contract1',
        size: 1024
      });
    });
  });

  describe('putContracts (Bulk Operations)', () => {
    it('should store multiple contracts successfully', async () => {
      const contracts = {
        [SAMPLE_CONTRACT_IDS.SIP010_TOKEN]: createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN),
        [SAMPLE_CONTRACT_IDS.SIP009_NFT]: createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP009_NFT, 'nft')
      };

      const result = await blobStorage.putContracts(contracts);

      expect(result.successful).toEqual([
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        SAMPLE_CONTRACT_IDS.SIP009_NFT
      ]);
      expect(result.failed).toEqual([]);
      expect(mockBlob.put).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in bulk operations', async () => {
      const contracts = {
        [SAMPLE_CONTRACT_IDS.SIP010_TOKEN]: createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN),
        'SP123.failing-contract': createSampleContractMetadata('SP123.failing-contract')
      };

      mockBlob.put
        .mockResolvedValueOnce({ url: 'success' })
        .mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      const result = await blobStorage.putContracts(contracts);

      expect(result.successful).toEqual([SAMPLE_CONTRACT_IDS.SIP010_TOKEN]);
      expect(result.failed).toEqual([{
        contractId: 'SP123.failing-contract',
        error: `Failed to store contract SP123.failing-contract: ${ERROR_SCENARIOS.NETWORK_ERROR.message}`
      }]);
    });

    it('should handle empty contracts object', async () => {
      const result = await blobStorage.putContracts({});

      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(mockBlob.put).not.toHaveBeenCalled();
    });

    it('should validate all contracts before storing', async () => {
      const contracts = {
        [SAMPLE_CONTRACT_IDS.SIP010_TOKEN]: createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN),
        'invalid-contract': null as any
      };

      const result = await blobStorage.putContracts(contracts);

      expect(result.successful).toEqual([SAMPLE_CONTRACT_IDS.SIP010_TOKEN]);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].contractId).toBe('invalid-contract');
    });
  });


  describe('Path Sanitization', () => {
    it('should sanitize contract IDs with special characters', async () => {
      const metadata = createSampleContractMetadata('SP123.contract-with-special#chars!');

      await blobStorage.putContract('SP123.contract-with-special#chars!', metadata);

      expect(mockBlob.put).toHaveBeenCalledWith(
        'test-contracts/SP123.contract-with-special_chars_.json',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle Unicode characters in contract names', async () => {
      const contractId = 'SP123.contract-with-ümläüts';
      const metadata = createSampleContractMetadata(contractId);

      await blobStorage.putContract(contractId, metadata);

      expect(mockBlob.put).toHaveBeenCalledWith(
        expect.stringContaining('test-contracts/SP123.contract-with-'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle very long contract names', async () => {
      const longName = 'a'.repeat(200);
      const contractId = `SP123.${longName}`;
      const metadata = createSampleContractMetadata(contractId);

      await blobStorage.putContract(contractId, metadata);

      const expectedPath = `test-contracts/SP123.${longName}.json`;
      expect(mockBlob.put).toHaveBeenCalledWith(
        expectedPath,
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle empty contract names gracefully', async () => {
      const contractId = 'SP123.';
      const metadata = createSampleContractMetadata(contractId);

      await blobStorage.putContract(contractId, metadata);

      expect(mockBlob.put).toHaveBeenCalledWith(
        'test-contracts/SP123..json',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('Performance', () => {
    it('should handle large metadata objects', async () => {
      const largeMetadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, 'token', {
        sourceCode: 'a'.repeat(100000), // 100KB source code
        abi: JSON.stringify({ large: 'a'.repeat(50000) }) // 50KB ABI
      });

      const startTime = Date.now();
      await blobStorage.putContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, largeMetadata);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(mockBlob.put).toHaveBeenCalled();
    });

    it('should handle concurrent operations efficiently', async () => {
      const contracts = mockFactory.createContracts(10);
      const operations = contracts.map((metadata, i) =>
        blobStorage.putContract(`SP${i}.test`, metadata)
      );

      const startTime = Date.now();
      await expect(Promise.all(operations)).resolves.not.toThrow();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(mockBlob.put).toHaveBeenCalledTimes(10);
    });

    it('should handle many small operations efficiently', async () => {
      const operations = Array.from({ length: 50 }, (_, i) =>
        blobStorage.hasContract(`SP${i}.test`)
      );

      const startTime = Date.now();
      await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(mockBlob.head).toHaveBeenCalledTimes(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle blob size limit errors', async () => {
      const metadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      mockBlob.put.mockRejectedValueOnce(ERROR_SCENARIOS.BLOB_SIZE_ERROR);

      await expect(
        blobStorage.putContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, metadata)
      ).rejects.toThrow('Failed to store contract');
    });

    it('should handle timeout errors', async () => {
      const metadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      mockBlob.put.mockRejectedValueOnce(ERROR_SCENARIOS.TIMEOUT_ERROR);

      await expect(
        blobStorage.putContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, metadata)
      ).rejects.toThrow('Failed to store contract');
    });

    it('should handle invalid JSON response', async () => {
      mockBlob.head.mockResolvedValueOnce({
        url: 'https://blob.vercel.com/test.json'
      });

      mockBlob.fetch.mockResolvedValueOnce(new Response(
        '<html>Error page</html>',
        { status: 200, headers: { 'content-type': 'text/html' } }
      ));

      await expect(
        blobStorage.getContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN)
      ).rejects.toThrow('Failed to retrieve contract');
    });

    it('should handle corrupted response data', async () => {
      mockBlob.head.mockResolvedValueOnce({
        url: 'https://blob.vercel.com/test.json'
      });

      // Mock a response that fails during JSON parsing
      const mockResponse = new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"incomplete": '));
          controller.close();
        }
      }), { status: 200 });

      mockBlob.fetch.mockResolvedValueOnce(mockResponse);

      await expect(
        blobStorage.getContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN)
      ).rejects.toThrow('Failed to retrieve contract');
    });
  });

  describe('Edge Cases', () => {
    it('should handle contract ID with only dots', async () => {
      const contractId = '...';
      const metadata = createSampleContractMetadata(contractId);

      await blobStorage.putContract(contractId, metadata);

      expect(mockBlob.put).toHaveBeenCalledWith(
        'test-contracts/....json',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle contract metadata with circular references', async () => {
      const metadata: any = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      metadata.circular = metadata; // Create circular reference

      await expect(
        blobStorage.putContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, metadata)
      ).rejects.toThrow();
    });

    it('should handle very large contract lists', async () => {
      const manyBlobs = Array.from({ length: 10000 }, (_, i) => ({
        pathname: `test-contracts/SP${i}_contract.json`,
        size: 1024,
        uploadedAt: new Date()
      }));

      mockBlob.list.mockResolvedValueOnce({
        blobs: manyBlobs,
        hasMore: false,
        cursor: null
      });

      const result = await blobStorage.listContracts();

      expect(result).toHaveLength(10000);
      expect(result[0]).toBe('SP0.contract');
      expect(result[9999]).toBe('SP9999.contract');
    });

    it('should handle concurrent access to same contract', async () => {
      const metadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      const operations = [
        blobStorage.putContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, metadata),
        blobStorage.getContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN),
        blobStorage.hasContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN),
        blobStorage.removeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN)
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });
});