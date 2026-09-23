import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BalanceResponse } from '@repo/tokens';
import { fetchAddressBalances } from './balances';

const ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const CHA = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';

const apiResponse: BalanceResponse = {
  address: ADDRESS,
  lastUpdated: '2026-09-23T00:00:00.000Z',
  source: 'stacks-api',
  stxBalance: '1500000',
  fungibleTokens: {
    [CHA]: { balance: '42000000', decimals: 6 },
  },
  nonFungibleTokens: { 'SP1.some-nft': { count: '1' } },
  metadata: {
    cacheSource: 'live',
    tokenCount: 1,
    nftCount: 1,
    stxLocked: '500000',
    stxTotalSent: '10',
    stxTotalReceived: '20',
  },
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAddressBalances', () => {
  it('requests the app balances route with a relative URL including zero balances', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(apiResponse), { status: 200 }));

    await fetchAddressBalances(ADDRESS);

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(new RegExp(`^/api/v1/balances/${ADDRESS}\\?includeZero=true`));
  });

  it('maps the API response into the polyglot account balance shape', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(apiResponse), { status: 200 }));

    const result = await fetchAddressBalances(ADDRESS);

    expect(result.stx.balance).toBe('1500000');
    expect(result.stx.locked).toBe('500000');
    expect(result.stx.total_sent).toBe('10');
    expect(result.stx.total_received).toBe('20');
    expect(result.fungible_tokens[CHA].balance).toBe('42000000');
    expect(result.non_fungible_tokens).toEqual(apiResponse.nonFungibleTokens);
  });

  it('throws a descriptive error when the route responds with a failure status', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"boom"}', { status: 500 }));

    await expect(fetchAddressBalances(ADDRESS)).rejects.toThrow(
      `Failed to fetch balances for ${ADDRESS}: 500`
    );
  });
});
