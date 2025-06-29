// Test setup file for charisma-party
// This file runs before each test file
/// <reference path="./test-utils.d.ts" />
import { vi } from 'vitest';
import type { TestUtils } from './test-utils';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PARTYKIT_ENV = 'test';

// Mock external dependencies
vi.mock('@repo/polyglot', () => ({
  getAccountBalances: vi.fn(),
  callReadOnlyFunction: vi.fn()
}));

vi.mock('@repo/tokens', () => ({
  listPrices: vi.fn(),
  fetchMetadata: vi.fn()
}));

// Mock balances-lib functions (partially)
vi.mock('../src/balances-lib', async () => {
  const actual = await vi.importActual('../src/balances-lib') as any;
  return {
    ...actual,
    loadTokenMetadata: vi.fn(),
    fetchUserBalances: vi.fn().mockImplementation(actual.fetchUserBalances),
    isValidUserAddress: vi.fn().mockImplementation((address: string) => 
      address.startsWith('SP') || address.startsWith('ST')
    )
  };
});

// Mock PartyKit server classes for testing
vi.mock('partykit/server', () => ({
  Party: {
    Room: vi.fn(),
    Connection: vi.fn(),
    Server: vi.fn()
  }
}));

// Mock WebSocket for client-side testing
class MockWebSocket {
  constructor(public url: string) {}
  send = vi.fn();
  close = vi.fn();
  readyState = WebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
}

global.WebSocket = MockWebSocket as any;

// Mock console methods to reduce noise in tests but make them spies
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn() // Make error a spy too for testing
};

// Global test utilities
global.TEST_UTILS = {
  createMockConnection: (id: string = 'test-client') => ({
    id,
    send: vi.fn(),
    close: vi.fn()
  }),
  
  createMockRoom: (id: string = 'test-room') => ({
    id,
    broadcast: vi.fn(),
    getConnection: vi.fn(),
    storage: {
      setAlarm: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    }
  }),
  
  createMockTokenMetadata: (overrides = {}) => ({
    contractId: 'SP000000000000000000002Q6VF78.test-token',
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 6,
    type: 'SIP10',
    identifier: '',
    description: 'A test token',
    image: null,
    token_uri: null,
    total_supply: '1000000',
    lastUpdated: Date.now(),
    verified: false,
    price: 1.50,
    change24h: 0.05,
    marketCap: 1500000,
    base: null,
    ...overrides
  }),
  
  createMockBalanceData: (overrides = {}) => ({
    userId: 'SP000000000000000000002Q6VF78',
    contractId: 'SP000000000000000000002Q6VF78.test-token',
    balance: 1000000,
    totalSent: '0',
    totalReceived: '1000000',
    timestamp: Date.now(),
    source: 'test',
    ...overrides
  }),
  
  createMockRequest: (url: string, options: RequestInit = {}) => ({
    url,
    method: options.method || 'GET',
    headers: new Headers(options.headers),
    ...options,
    // Add required PartyKit properties
    fetcher: {
      fetch: vi.fn()
    }
  })
};

// TypeScript declarations are in ./global.d.ts
