/**
 * Unified Test Setup for Vitest - Contract Registry
 * Handles both unit tests (with mocks) and integration tests (without mocks)
 */

import { vi, beforeEach } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Detect test type based on file path or environment
const isIntegrationTest = process.env.VITEST_POOL_ID?.includes('integration') ||
  process.argv.some(arg => arg.includes('integration'));

// Load environment variables for integration tests
if (isIntegrationTest) {
  dotenv.config({ path: path.join(process.cwd(), '.env.local') });
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

// Only apply mocks for unit tests, not integration tests
if (!isIntegrationTest) {
  // Mock @vercel/kv with comprehensive KV operations
  vi.mock('@vercel/kv', () => ({
    kv: {
      // Basic operations
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      mget: vi.fn(),
      mset: vi.fn(),
      scan: vi.fn(),
      exists: vi.fn(),
      expire: vi.fn(),
      pipeline: vi.fn(),
      multi: vi.fn(),
      flushall: vi.fn(),
      info: vi.fn(),

      // Set operations for IndexManager
      sadd: vi.fn(),
      srem: vi.fn(),
      smembers: vi.fn(),
      scard: vi.fn(),
      sismember: vi.fn(),

      // Hash operations (if needed)
      hget: vi.fn(),
      hset: vi.fn(),
      hdel: vi.fn(),
      hgetall: vi.fn(),

      // List operations (if needed)
      lpush: vi.fn(),
      rpush: vi.fn(),
      lpop: vi.fn(),
      rpop: vi.fn(),
      llen: vi.fn()
    }
  }));

  // Mock @modules/blob-monitor with comprehensive blob operations
  vi.mock('@modules/blob-monitor', () => ({
    BlobMonitor: vi.fn().mockImplementation(() => ({
      // Core blob operations
      put: vi.fn().mockResolvedValue({ url: 'https://blob.vercel.com/test.json' }),
      get: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      head: vi.fn().mockResolvedValue({
        url: 'https://blob.vercel.com/test.json',
        size: 1024,
        uploadedAt: new Date()
      }),
      fetch: vi.fn().mockResolvedValue(new Response('{"test": "data"}', {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-vercel-cache': 'HIT' }
      })),
      list: vi.fn().mockResolvedValue({
        blobs: [],
        hasMore: false,
        cursor: null
      }),
      copy: vi.fn(),

      // Monitoring operations
      getStats: vi.fn().mockReturnValue({
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
      }),
      getRecentOperations: vi.fn().mockReturnValue([]),
      getAlerts: vi.fn().mockReturnValue([]),
      clearResolvedAlerts: vi.fn(),
      resetStats: vi.fn()
    }))
  }));

  // Mock @vercel/blob directly
  vi.mock('@vercel/blob', () => ({
    put: vi.fn().mockResolvedValue({ url: 'https://blob.vercel.com/test.json' }),
    del: vi.fn().mockResolvedValue(undefined),
    head: vi.fn().mockResolvedValue({
      url: 'https://blob.vercel.com/test.json',
      size: 1024,
      uploadedAt: new Date()
    }),
    list: vi.fn().mockResolvedValue({
      blobs: [],
      hasMore: false,
      cursor: null
    }),
    copy: vi.fn().mockResolvedValue({ url: 'https://blob.vercel.com/copied.json' })
  }));

  // Mock @repo/polyglot with contract analysis functionality
  vi.mock('@repo/polyglot', () => ({
    getContractInfoWithParsedAbi: vi.fn(),
    getContractInfo: vi.fn(),
    parseContractAbi: vi.fn(),
    callReadOnly: vi.fn(),
    callReadOnlyFunction: vi.fn(),
    getContractInterface: vi.fn(),
    searchContractsByTrait: vi.fn().mockResolvedValue([])
  }));

  // Mock @repo/tokens with token listing functionality
  vi.mock('@repo/tokens', () => ({
    listTokens: vi.fn().mockResolvedValue([]),
    getToken: vi.fn(),
    searchTokens: vi.fn()
  }));

  // Mock fetch for external API calls
  global.fetch = vi.fn();

  // Mock AbortController for request cancellation
  global.AbortController = vi.fn().mockImplementation(() => ({
    abort: vi.fn(),
    signal: {
      aborted: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  }));

  // Mock setTimeout/clearTimeout for testing timeouts
  global.setTimeout = Object.assign(
    vi.fn().mockImplementation((fn, delay) => {
      if (typeof fn === 'function') {
        fn();
      }
      return 1;
    }),
    { __promisify__: vi.fn() }
  ) as any;
  global.clearTimeout = vi.fn();

  // Mock console methods in tests to avoid noise
  const originalConsole = console;
  global.console = {
    ...originalConsole,
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  };

  // Mock process.env for configuration
  process.env.NODE_ENV = 'test';
  process.env.HIRO_API_KEY = 'test-api-key';
  process.env.BLOB_BASE_URL = 'https://blob.vercel.com';

  // Setup test environment
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset fetch mock
    (global.fetch as any).mockClear();

    // Reset console mocks
    if (vi.mocked(console.warn).mockClear) {
      vi.mocked(console.warn).mockClear();
      vi.mocked(console.error).mockClear();
      vi.mocked(console.log).mockClear();
      vi.mocked(console.info).mockClear();
      vi.mocked(console.debug).mockClear();
    }

    // Reset timeout mocks
    vi.mocked(global.setTimeout).mockClear();
    vi.mocked(global.clearTimeout).mockClear();
  });

} // End of unit test mocks

// Test utilities for common mock setups (available for both unit and integration tests)
export const mockUtils = {
  /**
   * Setup successful KV operations
   */
  setupKvMocks: (data: Record<string, any> = {}) => {
    const kvMock = vi.mocked(require('@vercel/kv').kv);
    kvMock.get.mockImplementation((key: string) => Promise.resolve(data[key] || null));
    kvMock.set.mockResolvedValue('OK');
    kvMock.del.mockResolvedValue(1);
    kvMock.smembers.mockResolvedValue([]);
    kvMock.scard.mockResolvedValue(0);
    kvMock.sismember.mockResolvedValue(0);
    return kvMock;
  },

  /**
   * Setup successful blob operations
   */
  setupBlobMocks: (blobs: any[] = [], contracts: Record<string, any> = {}) => {
    const BlobMonitorMock = vi.mocked(require('@modules/blob-monitor').BlobMonitor);

    // Get the mock implementation that was created in the global setup
    const mockInstance = BlobMonitorMock.prototype || BlobMonitorMock.mockImplementation.mock.calls[0]?.[0]() || {
      put: vi.fn().mockResolvedValue({ url: 'https://blob.vercel.com/test.json' }),
      get: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      head: vi.fn().mockResolvedValue({
        url: 'https://blob.vercel.com/test.json',
        size: 1024,
        uploadedAt: new Date()
      }),
      fetch: vi.fn().mockImplementation((url: string) => {
        // Try to determine the contract ID from the URL
        const contractId = Object.keys(contracts)[0];
        const contractData = contracts[contractId] || { test: 'data' };

        return Promise.resolve(new Response(JSON.stringify(contractData), {
          status: 200,
          headers: { 'content-type': 'application/json', 'x-vercel-cache': 'HIT' }
        }));
      }),
      list: vi.fn().mockResolvedValue({
        blobs,
        hasMore: false,
        cursor: null
      }),
      copy: vi.fn(),
      getStats: vi.fn().mockReturnValue({
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
      }),
      getRecentOperations: vi.fn().mockReturnValue([]),
      getAlerts: vi.fn().mockReturnValue([]),
      clearResolvedAlerts: vi.fn(),
      resetStats: vi.fn()
    };

    // Update the existing mock to return our custom blobs and contract data
    if (mockInstance.list) {
      mockInstance.list.mockResolvedValue({ blobs, hasMore: false, cursor: null });
    }
    if (mockInstance.fetch && contracts) {
      mockInstance.fetch.mockImplementation((url: string) => {
        const contractId = Object.keys(contracts)[0];
        const contractData = contracts[contractId] || { test: 'data' };

        return Promise.resolve(new Response(JSON.stringify(contractData), {
          status: 200,
          headers: { 'content-type': 'application/json', 'x-vercel-cache': 'HIT' }
        }));
      });
    }

    return mockInstance;
  },

  /**
   * Setup contract analysis mocks
   */
  setupContractMocks: (contractInfo: any = null) => {
    const polyglotMock = vi.mocked(require('@repo/polyglot'));
    polyglotMock.getContractInfoWithParsedAbi.mockResolvedValue(contractInfo);
    polyglotMock.callReadOnly.mockResolvedValue(null);
    polyglotMock.searchContractsByTrait.mockResolvedValue([]);
    return polyglotMock;
  },

  /**
   * Setup token listing mocks
   */
  setupTokenMocks: (tokens: any[] = []) => {
    const tokensMock = vi.mocked(require('@repo/tokens'));
    tokensMock.listTokens.mockResolvedValue(tokens);
    return tokensMock;
  },

  /**
   * Setup fetch mock with response
   */
  setupFetchMock: (response: any, ok: boolean = true) => {
    (global.fetch as any).mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Internal Server Error',
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
      headers: new Headers({ 'content-type': 'application/json' })
    });
    return global.fetch;
  }
};

// Integration test utilities and configuration
export const integrationUtils = {
  wait: async (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  /**
   * Retry operation with exponential backoff
   */
  retryOperation: async <T>(
    operation: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError || new Error('Operation failed after retries');
  },
  skipIfMissingEnv: (requiredEnvVars: string[] = [], reason: string = 'integration test') => {
    if (isIntegrationTest) {
      const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
      if (missingVars.length > 0) {
        console.warn(`Skipping ${reason} due to missing environment variables: ${missingVars.join(', ')}`);
        return true;
      }
    }
    return false;
  },
  /**
   * Check if integration test should be skipped due to missing environment variables
   */
  shouldSkipIntegrationTest: (requiredEnvVars: string[] = []): boolean => {
    if (!isIntegrationTest) return false;

    return requiredEnvVars.some(envVar => !process.env[envVar]);
  },

  /**
   * Wait for a condition to be true with timeout
   */
  waitForCondition: async (
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 10000,
    intervalMs: number = 100
  ): Promise<void> => {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Condition not met within ${timeoutMs}ms`);
  },

  /**
   * Generate unique test identifier
   */
  generateTestId: (): string => {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

export const integrationConfig = {
  /**
   * Default timeouts for integration tests
   */
  timeouts: {
    default: 30000,
    discovery: 60000,
    analysis: 45000,
    indexing: 30000
  },

  /**
   * Test contract samples for integration testing
   */
  testContracts: {
    valid: [
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-stx-token',
      'SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin'
    ],
    invalid: [
      'INVALID.contract-test',
      'NONEXISTENT.contract-test'
    ]
  },
  hiro: {
    apiKey: process.env.HIRO_API_KEY || 'test-api-key',
    baseUrl: process.env.HIRO_API_BASE_URL || 'https://api.hiro.so'
  },

  /**
   * Rate limiting and retry configuration
   */
  rateLimit: {
    maxRetries: 3,
    retryDelayMs: 1000,
    batchSize: 10
  }
};