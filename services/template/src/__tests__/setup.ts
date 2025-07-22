/**
 * Test setup file for Vitest - Service Template
 * Comprehensive mocking for all common external dependencies
 */

import { vi, beforeEach } from 'vitest';

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
  getContractInterface: vi.fn()
}));

// Mock @repo/tokens with token listing functionality
vi.mock('@repo/tokens', () => ({
  listTokens: vi.fn().mockResolvedValue([]),
  getToken: vi.fn(),
  searchTokens: vi.fn()
}));

// Mock @modules/contracts for contract utilities
vi.mock('@modules/contracts', () => ({
  // Add contract-related mocks as needed
  validateContractId: vi.fn(),
  parseContractId: vi.fn()
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

// Setup test environment
beforeEach(() => {
  vi.clearAllMocks();

  // Reset fetch mock
  (global.fetch as any).mockClear();

  // Reset console mocks
  vi.mocked(console.warn).mockClear();
  vi.mocked(console.error).mockClear();
  vi.mocked(console.log).mockClear();
  vi.mocked(console.info).mockClear();
  vi.mocked(console.debug).mockClear();

  // Reset timeout mocks
  vi.mocked(global.setTimeout).mockClear();
  vi.mocked(global.clearTimeout).mockClear();
});

// Test utilities for common mock setups
export const mockUtils = {
  /**
   * Setup successful KV operations
   */
  setupKvMocks: async (data: Record<string, any> = {}) => {
    // Import from mocked module
    const { kv } = await import('@vercel/kv');
    const mockedKv = vi.mocked(kv);
    mockedKv.get.mockImplementation((key: string) => Promise.resolve(data[key] || null));
    mockedKv.set.mockResolvedValue('OK');
    mockedKv.del.mockResolvedValue(1);
    mockedKv.smembers.mockResolvedValue([]);
    mockedKv.scard.mockResolvedValue(0);
    mockedKv.sismember.mockResolvedValue(0);
    return mockedKv;
  },

  /**
   * Setup successful blob operations
   */
  setupBlobMocks: (blobs: any[] = []) => {
    // Return a simple mock object that can be used directly
    const mockInstance = {
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
        headers: { 'content-type': 'application/json' }
      })),
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

    return mockInstance;
  },

  /**
   * Setup contract analysis mocks
   */
  setupContractMocks: (contractInfo: any = null) => {
    const polyglotMock = vi.mocked(require('@repo/polyglot'));
    polyglotMock.getContractInfoWithParsedAbi.mockResolvedValue(contractInfo);
    polyglotMock.callReadOnly.mockResolvedValue(null);
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