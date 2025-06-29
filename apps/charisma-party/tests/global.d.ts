/**
 * Global test utilities type declarations
 * This file ensures TypeScript recognizes the TEST_UTILS global object
 */

declare global {
  var TEST_UTILS: {
    createMockConnection: (id?: string) => {
      id: string;
      send: import('vitest').MockedFunction<any>;
      close: import('vitest').MockedFunction<any>;
    };

    createMockRoom: (id?: string) => {
      id: string;
      broadcast: import('vitest').MockedFunction<any>;
      getConnection: import('vitest').MockedFunction<any>;
      storage: {
        setAlarm: import('vitest').MockedFunction<any>;
        get: import('vitest').MockedFunction<any>;
        put: import('vitest').MockedFunction<any>;
        delete: import('vitest').MockedFunction<any>;
      };
    };

    createMockTokenMetadata: (overrides?: Partial<{
      contractId: string;
      name: string;
      symbol: string;
      decimals: number;
      type: string;
      identifier: string;
      description: string | null;
      image: string | null;
      token_uri: string | null;
      total_supply: string | null;
      lastUpdated: number | null;
      verified: boolean;
      price: number | null;
      change24h: number | null;
      marketCap: number | null;
      base: string | null;
    }>) => any;

    createMockBalanceData: (overrides?: Partial<{
      userId: string;
      contractId: string;
      balance: number;
      totalSent: string;
      totalReceived: string;
      timestamp: number;
      source: string;
    }>) => any;

    createMockRequest: (url: string, options?: RequestInit) => {
      url: string;
      method: string;
      headers: Headers;
      fetcher: {
        fetch: import('vitest').MockedFunction<any>;
      };
    };
  };
}

// This export is needed to make this file a module
export { };