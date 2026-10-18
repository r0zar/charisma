import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Router,
  defaultConfig,
  buildSwapTransaction,
  fetchQuote,
  OPCODES,
  Vault,
  Token,
} from "../index";

// Mock external dependencies explicitly, so the router under test gets these exact functions
const { mockCallReadOnly, mockGetTokenMetadataCached } = vi.hoisted(() => ({
  mockCallReadOnly: vi.fn(),
  mockGetTokenMetadataCached: vi.fn(),
}));
vi.mock('@repo/polyglot', () => ({ callReadOnly: mockCallReadOnly }));
vi.mock('@repo/tokens', () => ({ getTokenMetadataCached: mockGetTokenMetadataCached }));

// Mock fetch for API calls
global.fetch = vi.fn();

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
    vi.clearAllMocks();
    
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
    global.fetch.mockImplementation((url: any) => {
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

    // A path exists but its only pool can't fill the trade, so there is no usable route: findBestRoute throws why
    await expect(router.findBestRoute(mockTokenA.contractId, mockTokenB.contractId, 1000000))
      .rejects.toThrow(/No usable route/);
  });

  it("handles mocked network errors gracefully", async () => {
    // Temporarily clear all mocks and set up only the error mock
    vi.clearAllMocks();
    
    // Mock a network error for fetch
    global.fetch.mockRejectedValue(
      new Error('Network error')
    );

    await expect(fetchQuote('.stx', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-a', 1_000_000))
      .rejects.toThrow('Network error');
  }, 10000); // 10 second timeout for retry test
});

describe("findBestRoute: exact search", () => {
  const token = (name: string, type = 'SIP10'): Token => ({
    ...mockTokenA, type, contractId: `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.${name}`, symbol: name.toUpperCase(), identifier: name,
  });
  const pool = (name: string, a: Token, b: Token, reservesA = 1_000_000, reservesB = 1_000_000): Vault => ({
    ...mockVault, contractId: `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.${name}`, tokenA: a, tokenB: b, reservesA, reservesB,
  });
  /**
   * Each pool pays `rate` units of B per unit of A (and the inverse for B → A); pools in `failing` can't be quoted,
   * and a pool in `caps` quotes 0 for more than its cap, like ALEX's LiALEX pool past its max-in ratio
   */
  const quoting = (rates: Record<string, number>, failing: string[] = [], caps: Record<string, number> = {}) => (contractId: string, _fn: string, args: any[]) => {
    const name = contractId.split('.')[1];
    if (failing.includes(name)) return Promise.reject(new Error('quote failed'));
    const amount = Number(args[0].value);
    if (amount > (caps[name] ?? Infinity)) return Promise.resolve({ value: { dx: { value: String(amount) }, dy: { value: '0' }, dk: { value: '0' } } });
    const op = parseInt(args[1].value.value.slice(0, 2), 16);
    const rate = op === OPCODES.SWAP_B_TO_A ? 1 / rates[name] : rates[name];
    return Promise.resolve({ value: { dx: { value: String(amount) }, dy: { value: String(Math.floor(amount * rate)) }, dk: { value: '0' } } });
  };
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(n => token(n));
  const name = (v: Vault) => v.contractId.split('.')[1];

  beforeEach(() => vi.clearAllMocks());

  it("finds the direct pool even when four lopsided pools look far better on paper", async () => {
    const decoys = [1, 2, 3, 4].map(i => token(`c${i}`));
    // Balances like Bitflow LEO-STX on 18 Oct: plenty of the token out, almost none in, so x·y=k math promises a fortune
    const vaults = [pool('direct', a, b), ...decoys.flatMap(x => [pool(`a-${x.identifier}`, a, x, 1, 1e12), pool(`${x.identifier}-b`, x, b, 1, 1e12)])];
    mockCallReadOnly.mockImplementation(quoting({ direct: 0.9, ...Object.fromEntries(decoys.flatMap(x => [[`a-${x.identifier}`, 1], [`${x.identifier}-b`, 0.01]])) }));
    const router = new Router({ ...defaultConfig });
    router.loadVaults(vaults);
    const route = await router.findBestRoute(a.contractId, b.contractId, 1_000_000);
    expect(route.amountOut).toBe(900_000);
    expect(route.hops.map(h => name(h.vault))).toEqual(['direct']);
  });

  it("takes a two-hop route when it pays more than the direct pool", async () => {
    mockCallReadOnly.mockImplementation(quoting({ 'a-b': 1, 'a-c': 0.5, 'c-b': 4 }));
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-b', a, b), pool('a-c', a, c), pool('c-b', c, b)]);
    const route = await router.findBestRoute(a.contractId, b.contractId, 1_000_000);
    expect(route.amountOut).toBe(2_000_000);
    expect(route.path.map(t => t.identifier)).toEqual(['a', 'c', 'b']);
    expect(route.hops.map(h => h.quote)).toEqual([{ amountIn: 1_000_000, amountOut: 500_000 }, { amountIn: 500_000, amountOut: 2_000_000 }]);
  });

  it("routes around a pool whose quote fails", async () => {
    mockCallReadOnly.mockImplementation(quoting({ 'a-b': 1, 'a-c': 0.5, 'c-b': 1 }, ['a-b']));
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-b', a, b), pool('a-c', a, c), pool('c-b', c, b)]);
    const route = await router.findBestRoute(a.contractId, b.contractId, 1_000_000);
    expect(route.amountOut).toBe(500_000);
    expect(route.hops.map(h => name(h.vault))).toEqual(['a-c', 'c-b']);
  });

  it("gives a trade out of a subnet one extra hop for the 1:1 unwrap", async () => {
    const sa: Token = { ...token('a-subnet', 'SUBNET'), base: a.contractId };
    mockCallReadOnly.mockImplementation(quoting({ 'a-wrap': 1, 'a-b': 2 }));
    const router = new Router({ ...defaultConfig, maxHops: 1 });
    router.loadVaults([pool('a-wrap', a, sa), pool('a-b', a, b)]);
    const route = await router.findBestRoute(sa.contractId, b.contractId, 1_000_000);
    expect(route.hops.map(h => h.opcode)).toEqual([OPCODES.OP_WITHDRAW, OPCODES.SWAP_A_TO_B]);
    expect(route.amountOut).toBe(2_000_000);
  });

  it("closes a loop back to the starting token when from and to are the same", async () => {
    mockCallReadOnly.mockImplementation(quoting({ 'a-b-1': 2, 'a-b-2': 1 }));
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-b-1', a, b), pool('a-b-2', a, b)]);
    const route = await router.findBestRoute(a.contractId, a.contractId, 1_000_000);
    // Out through the pool paying 2 B per A, back through the one paying 1 A per B
    expect(route.amountOut).toBe(2_000_000);
    expect(route.hops.map(h => name(h.vault))).toEqual(['a-b-1', 'a-b-2']);
  });

  it("brings a pool that caps how much it takes the most it will take", async () => {
    // B arrives as 2.0M and 1.8M (one hop) and 1.6M and 1.4M (two hops, through C); b-d refuses more than 1.7M
    mockCallReadOnly.mockImplementation(quoting({ 'a-b-1': 2, 'a-b-2': 1.8, 'a-c': 1, 'c-b-1': 1.6, 'c-b-2': 1.4, 'b-d': 1 }, [], { 'b-d': 1_700_000 }));
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-b-1', a, b), pool('a-b-2', a, b), pool('a-c', a, c), pool('c-b-1', c, b), pool('c-b-2', c, b), pool('b-d', b, d)]);
    const route = await router.findBestRoute(a.contractId, d.contractId, 1_000_000);
    expect(route.amountOut).toBe(1_600_000);
    expect(route.hops.map(h => name(h.vault))).toEqual(['a-c', 'c-b-1', 'b-d']);
  });

  it("keeps a smaller amount from a longer route when a pool further on caps what it takes", async () => {
    // Like sBTC → LiALEX on 18 Oct: the direct L route brings 2M of X, over x-y's cap; going through S brings 1.5M
    const [l, s, x, y] = ['l', 's', 'x', 'y'].map(n => token(n));
    mockCallReadOnly.mockImplementation(quoting({ 'a-l': 2, 'a-s': 1, 's-l': 1.5, 'l-x': 1, 'x-y': 1 }, [], { 'x-y': 1_700_000 }));
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-l', a, l), pool('a-s', a, s), pool('s-l', s, l), pool('l-x', l, x), pool('x-y', x, y)]);
    const route = await router.findBestRoute(a.contractId, y.contractId, 1_000_000);
    expect(route.amountOut).toBe(1_500_000);
    expect(route.hops.map(h => name(h.vault))).toEqual(['a-s', 's-l', 'l-x', 'x-y']);
  });

  it("asks a pool that refuses everything only twice: the most and the least it could be given", async () => {
    // C arrives as 1M, 0.5M and 0.25M; c-b takes nothing
    mockCallReadOnly.mockImplementation(quoting({ 'a-b': 1, 'a-c-1': 1, 'a-c-2': 0.5, 'a-c-3': 0.25, 'c-b': 1 }, [], { 'c-b': 0 }));
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-b', a, b), pool('a-c-1', a, c), pool('a-c-2', a, c), pool('a-c-3', a, c), pool('c-b', c, b)]);
    const route = await router.findBestRoute(a.contractId, b.contractId, 1_000_000);
    expect(route.hops.map(h => name(h.vault))).toEqual(['a-b']);
    const asked = mockCallReadOnly.mock.calls.filter(([id]) => id.endsWith('.c-b')).map(([, , args]) => Number(args[0].value));
    expect(asked).toEqual([1_000_000, 250_000]);
  });

  it("returns an empty route, without quoting, when no pools connect the tokens", async () => {
    const router = new Router({ ...defaultConfig });
    router.loadVaults([pool('a-b', a, b), pool('c-d', c, d)]);
    expect(await router.findBestRoute(a.contractId, c.contractId, 1_000_000)).toEqual({ path: [], hops: [], amountIn: 0, amountOut: 0 });
    expect(mockCallReadOnly).not.toHaveBeenCalled();
  });
});
