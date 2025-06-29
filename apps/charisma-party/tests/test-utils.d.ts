/**
 * Test utilities type definitions
 * This file provides proper TypeScript support for TEST_UTILS global object
 */

import type { MockedFunction } from 'vitest';

interface MockConnection {
  id: string;
  send: MockedFunction<any>;
  close: MockedFunction<any>;
}

interface MockRoom {
  id: string;
  broadcast: MockedFunction<any>;
  getConnection: MockedFunction<any>;
  storage: {
    setAlarm: MockedFunction<any>;
    get: MockedFunction<any>;
    put: MockedFunction<any>;
    delete: MockedFunction<any>;
  };
}

interface MockTokenMetadata {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  type: string;
  identifier: string;
  description?: string | null;
  image?: string | null;
  token_uri?: string | null;
  total_supply?: string | null;
  lastUpdated?: number | null;
  verified?: boolean;
  price?: number | null;
  change24h?: number | null;
  marketCap?: number | null;
  base?: string | null;
  [key: string]: any;
}

interface MockBalanceData {
  userId: string;
  contractId: string;
  balance: number;
  totalSent: string;
  totalReceived: string;
  timestamp: number;
  source: string;
  [key: string]: any;
}

interface MockRequest {
  url: string;
  method: string;
  headers: Headers;
  fetcher: {
    fetch: MockedFunction<any>;
  };
  [key: string]: any;
}

export interface TestUtils {
  createMockConnection: (id?: string) => MockConnection;
  createMockRoom: (id?: string) => MockRoom;
  createMockTokenMetadata: (overrides?: Partial<MockTokenMetadata>) => MockTokenMetadata;
  createMockBalanceData: (overrides?: Partial<MockBalanceData>) => MockBalanceData;
  createMockRequest: (url: string, options?: RequestInit) => MockRequest;
}

declare global {
  var TEST_UTILS: TestUtils;
}

export {};