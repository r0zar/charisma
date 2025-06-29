import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  Router,
  defaultConfig,
  buildSwapTransaction,
  fetchQuote,
  Vault,
  Token,
} from "../index";

// Mock external dependencies
jest.mock('@repo/polyglot');
jest.mock('@repo/tokens');

const polyglotMock = jest.requireMock('@repo/polyglot') as any;
const tokensMock = jest.requireMock('@repo/tokens') as any;
const mockCallReadOnly = polyglotMock.callReadOnly as jest.MockedFunction<any>;
const mockGetTokenMetadataCached = tokensMock.getTokenMetadataCached as jest.MockedFunction<any>;

// Mock fetch for API calls
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock data
const mockTokenA: Token = {
  type: 'SIP10',
  contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-a',
  name: 'Token A',
  symbol: 'TKNA',
  decimals: 6,
  identifier: 'token-a',
  description: 'Mock Token A',
  image: 'https://example.com/token-a.png'
};

const mockTokenB: Token = {
  type: 'SIP10',
  contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-b',
  name: 'Token B',
  symbol: 'TKNB',
  decimals: 6,
  identifier: 'token-b',
  description: 'Mock Token B',
  image: 'https://example.com/token-b.png'
};

const mockVault: Vault = {
  type: 'LP',
  contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.vault-a-b',
  name: 'Token A-B Vault',
  symbol: 'LP-AB',
  decimals: 6,
  identifier: 'vault-a-b',
  description: 'Mock Vault for Token A and B',
  image: 'https://example.com/vault-ab.png',
  fee: 3000, // 0.3% fee
  externalPoolId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.pool-1',
  engineContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.engine',
  tokenA: mockTokenA,
  tokenB: mockTokenB,
  reservesA: 1000000,
  reservesB: 2000000,
};

describe("dexterity-sdk (mocked)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock token metadata responses
    mockGetTokenMetadataCached.mockImplementation((contractId: string) => {
      if (contractId === 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-a') return Promise.resolve(mockTokenA);
      if (contractId === 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-b') return Promise.resolve(mockTokenB);
      if (contractId === 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.vault-a-b') return Promise.resolve({
        ...mockVault,
        tokenAContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-a',
        tokenBContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-b',
        lpRebatePercent: 0.3
      });
      return Promise.resolve(null);
    });

    // Mock read-only contract calls
    mockCallReadOnly.mockImplementation((contractId: string, functionName: string, args: any[]) => {
      if (functionName === 'quote') {
        return Promise.resolve({
          value: {
            dx: { value: '1000000' },
            dy: { value: '1950000' }, // Mock output with slippage
            dk: { value: '0' }
          }
        });
      }
      return Promise.resolve({ value: null });
    });

    // Mock fetch responses
    (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation((url: any) => {
      const urlStr = url.toString();
      
      if (urlStr.includes('/vaults')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            data: [mockVault]
          })
        } as Response);
      }
      
      if (urlStr.includes('/tokens')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            data: [mockTokenA, mockTokenB]
          })
        } as Response);
      }
      
      if (urlStr.includes('/quote')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              path: [mockTokenA, mockTokenB],
              hops: [{
                vault: mockVault,
                tokenIn: mockTokenA,
                tokenOut: mockTokenB,
                opcode: 0,
                quote: { amountIn: 1000000, amountOut: 1950000 }
              }],
              amountIn: 1000000,
              amountOut: 1950000
            }
          })
        } as Response);
      }
      
      return Promise.reject(new Error('Unmocked URL: ' + urlStr));
    });
  });

  it("loads mocked vaults and builds graph stats", async () => {
    const router = new Router({ ...defaultConfig, debug: true });
    
    // Simulate loadVaults by calling router.loadVaults directly with mock data
    router.loadVaults([mockVault]);

    const stats = router.stats();
    console.log("Graph stats →", stats);
    
    const vaultContractIds = router.vaultContractIds();
    console.log("Vault contract IDs →", vaultContractIds);
    
    const tokenContractIds = router.tokenContractIds();
    console.log("Token contract IDs →", tokenContractIds);

    expect(stats.pools).toBe(1);
    expect(stats.tokens).toBe(2);
    expect(vaultContractIds).toContain('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.vault-a-b');
    expect(tokenContractIds).toContain('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-a');
    expect(tokenContractIds).toContain('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-b');
  });

  it("finds a route between two tokens using mocked data", async () => {
    const router = new Router({ ...defaultConfig, debug: true });
    router.loadVaults([mockVault]);

    const from = mockTokenA.contractId;
    const to = mockTokenB.contractId;

    const best = await router.findBestRoute(from, to, 1_000_000);
    console.log("Best route →", best);

    expect(!(best instanceof Error)).toBe(true);
    if (best instanceof Error) return;

    expect(best.hops.length).toBeGreaterThan(0);
    expect(best.amountOut).toBeGreaterThan(0);
    expect(best.hops[0].vault.contractId).toBe(mockVault.contractId);
  });

  it("builds a swap-transaction config using mocked route", async () => {
    const router = new Router({
      ...defaultConfig,
      routerContractId: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop",
      debug: true,
    });

    router.loadVaults([mockVault]);
    
    const route = await router.findBestRoute(
      mockTokenA.contractId,
      mockTokenB.contractId,
      500_000,
    );

    if (route instanceof Error) {
      console.warn("Route search failed:", route);
      expect(false).toBe(true);
      return;
    }

    const txCfg = await buildSwapTransaction(router, route, "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop");
    console.log("Tx config →", {
      contract: txCfg.contract,
      fn: txCfg.functionName,
      args: txCfg.functionArgs.map((a) =>
        Buffer.isBuffer(a) ? a.toString("hex") : a
      ),
      postConditions: txCfg.postConditions.length,
    });

    expect(txCfg.functionArgs.length).toBe(route.hops.length + 1);
    expect(txCfg.postConditions.length).toBeGreaterThan(0);
    expect(txCfg.functionName).toBe('swap-1');
  });

  it("fetches a mocked quote from the API", async () => {
    const quote = await fetchQuote('.stx', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-a', 1_000_000);
    console.log("Quote →", quote);
    
    expect(quote).toBeDefined();
    expect(quote.amountIn).toBe(1000000);
    expect(quote.amountOut).toBe(1950000);
    expect(quote.hops).toHaveLength(1);
  });

  it("handles mocked vault with zero reserves gracefully", async () => {
    const emptyVault = {
      ...mockVault,
      contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.empty-vault',
      reservesA: 0,
      reservesB: 0,
    };

    // Override the mock to return zero output for empty vault
    mockCallReadOnly.mockImplementation((contractId: string, functionName: string, args: any[]) => {
      if (functionName === 'quote' && contractId === 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.empty-vault') {
        return Promise.resolve({
          value: {
            dx: { value: '1000000' },
            dy: { value: '0' }, // No output from empty vault
            dk: { value: '0' }
          }
        });
      }
      return Promise.resolve({
        value: {
          dx: { value: '1000000' },
          dy: { value: '1950000' },
          dk: { value: '0' }
        }
      });
    });

    const router = new Router({ ...defaultConfig, debug: true });
    router.loadVaults([emptyVault]);

    const route = await router.findBestRoute(
      mockTokenA.contractId,
      mockTokenB.contractId,
      1000000
    );

    // Should handle gracefully (either return error or empty route)
    expect(route instanceof Error || route.amountOut === 0).toBe(true);
  });

  it("handles mocked network errors gracefully", async () => {
    // Temporarily clear all mocks and set up only the error mock
    jest.clearAllMocks();
    
    // Mock a network error for fetch
    (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
      new Error('Network error')
    );

    await expect(fetchQuote('.stx', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-a', 1_000_000))
      .rejects.toThrow('Network error');
  }, 10000); // 10 second timeout for retry test
});
