import type { AccountBalancesResponse } from '@repo/polyglot';
import type { BalanceResponse } from '@repo/tokens';

/**
 * Fetch mainnet + subnet balances for an address from this app's own API route.
 * Runs in the browser; the route holds the Hiro API key server-side.
 */
export async function fetchAddressBalances(address: string): Promise<AccountBalancesResponse> {
  const response = await fetch(`/api/v1/balances/${address}?includeZero=true&_t=${Date.now()}`, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch balances for ${address}: ${response.status}`);
  }

  const data: BalanceResponse = await response.json();

  return {
    stx: {
      balance: data.stxBalance,
      total_sent: data.metadata.stxTotalSent,
      total_received: data.metadata.stxTotalReceived,
      locked: data.metadata.stxLocked,
    },
    fungible_tokens: Object.fromEntries(
      Object.entries(data.fungibleTokens).map(([contractId, token]) => [
        contractId,
        { balance: token.balance, total_sent: '0', total_received: token.balance },
      ])
    ),
    non_fungible_tokens: data.nonFungibleTokens,
  };
}
