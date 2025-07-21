/**
 * Template Service Tests
 * Basic tests to validate template functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockUtils } from './setup';
import { 
  createSampleItem, 
  testUtils, 
  ERROR_SCENARIOS,
  mockFactory
} from './test-fixtures';

// Simple service class for demonstration
class TemplateService {
  constructor(private config: { serviceName: string }) {}

  async processItem(id: string): Promise<{ id: string; processed: boolean }> {
    if (!id) {
      throw new Error('ID is required');
    }
    return { id, processed: true };
  }

  getServiceName(): string {
    return this.config.serviceName;
  }
}

describe('Template Service', () => {
  let service: TemplateService;

  beforeEach(() => {
    service = new TemplateService({ serviceName: 'test-service' });
  });

  describe('Configuration', () => {
    it('should initialize with service name', () => {
      expect(service.getServiceName()).toBe('test-service');
    });
  });

  describe('processItem', () => {
    it('should process valid item successfully', async () => {
      const result = await service.processItem('test-id');
      
      expect(result).toEqual({
        id: 'test-id',
        processed: true
      });
    });

    it('should throw error for empty ID', async () => {
      await expect(service.processItem('')).rejects.toThrow('ID is required');
    });
  });
});

describe('Test Fixtures', () => {
  it('should create sample items', () => {
    const item = createSampleItem('test-id', { status: 'inactive' });
    
    expect(item).toEqual({
      id: 'test-id',
      name: 'Sample item for test-id',
      timestamp: expect.any(Number),
      status: 'inactive',
      metadata: {
        version: 1,
        created: expect.any(Number),
        updated: expect.any(Number)
      }
    });
  });

  it('should create multiple items with factory', () => {
    const items = mockFactory.createItems(3);
    
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      id: 'SP0123.item-0',
      name: 'Sample Item 0',
      timestamp: expect.any(Number),
      value: 0
    });
  });

  it('should provide error scenarios', () => {
    expect(ERROR_SCENARIOS.NETWORK_ERROR).toBeInstanceOf(Error);
    expect(ERROR_SCENARIOS.NETWORK_ERROR.message).toBe('Network request failed');
  });
});

describe('Test Utils', () => {
  it('should generate random IDs', () => {
    const id1 = testUtils.randomId();
    const id2 = testUtils.randomId();
    
    expect(id1).toMatch(/^SP[A-Z0-9]+\.test-item-\d+$/);
    expect(id1).not.toBe(id2);
  });

  it('should create past timestamps', () => {
    const pastTime = testUtils.pastTimestamp(1);
    const now = Date.now();
    
    expect(pastTime).toBeLessThan(now);
    expect(now - pastTime).toBeGreaterThan(3600000 - 1000); // ~1 hour ago
  });

  it('should deep clone objects', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = testUtils.deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
  });
});

describe('Mock Utils', () => {
  it('should setup KV mocks', async () => {
    const data = { 'test-key': 'test-value' };
    const kvMock = await mockUtils.setupKvMocks(data);
    
    expect(kvMock.get).toBeDefined();
    expect(kvMock.set).toBeDefined();
    
    // Test the mock
    const result = await kvMock.get('test-key');
    expect(result).toBe('test-value');
  });

  it('should setup blob mocks', () => {
    const blobs = [{ name: 'test.json' }];
    const blobMock = mockUtils.setupBlobMocks(blobs);
    
    expect(blobMock.put).toBeDefined();
    expect(blobMock.get).toBeDefined();
    expect(blobMock.list).toBeDefined();
  });

  it('should setup fetch mocks', () => {
    const response = { data: 'test' };
    const fetchMock = mockUtils.setupFetchMock(response);
    
    expect(fetchMock).toBe(global.fetch);
  });
});

describe('Performance Testing', () => {
  it('should handle medium datasets efficiently', async () => {
    const items = mockFactory.createItems(100);
    const startTime = Date.now();
    
    // Simulate processing
    const processed = items.map(item => ({ ...item, processed: true }));
    const duration = Date.now() - startTime;
    
    expect(processed).toHaveLength(100);
    expect(duration).toBeLessThan(1000); // Should be very fast
  });
});