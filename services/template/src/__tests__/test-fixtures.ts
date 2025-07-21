/**
 * Test Fixtures for Service Template
 * Sample data and utilities for comprehensive testing
 */

// Sample data constants
export const SAMPLE_IDS = {
  SAMPLE_ITEM_1: 'SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.item-1',
  SAMPLE_ITEM_2: 'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60.item-2',
  INVALID_ITEM: 'INVALID.ITEM'
} as const;

// Error Scenarios for Testing
export const ERROR_SCENARIOS = {
  NETWORK_ERROR: new Error('Network request failed'),
  TIMEOUT_ERROR: new Error('Request timeout after 30000ms'),
  INVALID_RESPONSE: new Error('Invalid response format'),
  BLOB_SIZE_ERROR: new Error('Blob exceeds 512MB limit'),
  KV_ERROR: new Error('KV operation failed'),
  RATE_LIMIT_ERROR: new Error('Rate limit exceeded')
};

// Mock Factory Functions
export const mockFactory = {
  /**
   * Create multiple sample items
   */
  createItems: (count: number): any[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `SP${i}123.item-${i}`,
      name: `Sample Item ${i}`,
      timestamp: Date.now() - (i * 1000),
      value: i * 100
    }));
  },

  /**
   * Create large dataset for performance testing
   */
  createLargeDataset: (size: number = 1000): any[] => {
    return Array.from({ length: size }, (_, i) => ({
      id: `SP${i}123.large-item-${i}`,
      data: `Large data item ${i}`,
      timestamp: Date.now() - (i * 1000)
    }));
  },

  /**
   * Create invalid data for error testing
   */
  createInvalidData: () => ({
    invalidItem: {
      id: '', // Invalid empty ID
      name: null,
      timestamp: NaN, // Invalid timestamp
      value: 'invalid-number' as any
    },
    malformedJson: '{invalid json}',
    emptyData: '',
    nullData: null,
    undefinedData: undefined
  })
};

// Performance Test Configuration
export const PERFORMANCE_TEST_CONFIG = {
  SMALL_DATASET: 10,
  MEDIUM_DATASET: 100,
  LARGE_DATASET: 1000,
  STRESS_DATASET: 5000,
  TIMEOUT_THRESHOLD: 5000, // 5 seconds
  MEMORY_THRESHOLD: 100 * 1024 * 1024 // 100MB
};

// Test Utilities
export const testUtils = {
  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random ID
   */
  randomId: () => `SP${Math.random().toString(36).substr(2, 9).toUpperCase()}.test-item-${Date.now()}`,

  /**
   * Deep clone object for test isolation
   */
  deepClone: <T>(obj: T): T => JSON.parse(JSON.stringify(obj)),

  /**
   * Create timestamp in the past
   */
  pastTimestamp: (hoursAgo: number = 1) => Date.now() - (hoursAgo * 60 * 60 * 1000),

  /**
   * Create timestamp in the future
   */
  futureTimestamp: (hoursFromNow: number = 1) => Date.now() + (hoursFromNow * 60 * 60 * 1000),

  /**
   * Validate object structure
   */
  validateStructure: (obj: any, expectedKeys: string[]) => {
    const objKeys = Object.keys(obj);
    return expectedKeys.every(key => objKeys.includes(key));
  }
};

// Common test data factories
export const createSampleItem = (id: string, overrides: any = {}) => ({
  id,
  name: `Sample item for ${id}`,
  timestamp: Date.now(),
  status: 'active',
  metadata: {
    version: 1,
    created: Date.now(),
    updated: Date.now()
  },
  ...overrides
});

export const createSampleStats = () => ({
  totalItems: 100,
  activeItems: 85,
  inactiveItems: 15,
  lastUpdated: Date.now(),
  cacheHitRate: 95.5,
  averageResponseTime: 150
});

// API Response Mocks
export const createSuccessResponse = (data: any) => ({
  status: 'success',
  data,
  timestamp: Date.now()
});

export const createErrorResponse = (error: string, code: number = 500) => ({
  status: 'error',
  error,
  code,
  timestamp: Date.now()
});