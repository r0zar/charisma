/**
 * Charisma's swap service: the best route between two tokens, and what it returns for an amount. Quotes are public
 * and the service allows any origin, so the Trade screen reads them directly.
 *
 * Building a swap happens here too, in the side panel: the router's own builder (dexterity-sdk) turns the route into
 * the call the wallet signs. Nothing is signed here, and the route's pools are checked against Charisma's vault list
 * first, so a route through an unknown pool never gets a transaction.
 */
import { Router, buildSwapTransaction, fetchVaults, type Route } from 'dexterity-sdk';
import { cvToHex, postConditionToHex } from '@stacks/transactions';

export type { Route };

/** STX's contract id, as the token list and the swap service name it */
export const STX = '.stx';

const SWAP_SERVICE = 'https://swap.charisma.rocks';

/** The best route for `amount` (smallest units of `tokenIn`) from `tokenIn` to `tokenOut`. Throws the service's reason. */
export async function getQuote(tokenIn: string, tokenOut: string, amount: string): Promise<Route> {
  const query = new URLSearchParams({ tokenIn, tokenOut, amount });
  const res = await fetch(`${SWAP_SERVICE}/api/v1/quote?${query}`);
  const body = (await res.json().catch(() => null)) as { success: boolean; data?: Route; error?: string } | null;
  if (!res.ok || !body?.success || !body.data) throw new Error(body?.error ?? `Quote failed (HTTP ${res.status})`);
  return body.data;
}

/** Every pool on the route must be the one on Charisma's vault list, with the same settings. Otherwise, no swap. */
export async function verifyRoute(route: Route) {
  const vaults = await fetchVaults();
  for (const { vault } of route.hops) {
    const known = vaults.find(candidate => candidate.contractId === vault.contractId);
    const same = !!known
      && (known.externalPoolId ?? '') === (vault.externalPoolId ?? '')
      && (known.stxWrapper ?? '') === (vault.stxWrapper ?? '')
      && Boolean(known.forwardsInputFee) === Boolean(vault.forwardsInputFee);
    if (!same) throw new Error(`The route goes through a pool that isn't on Charisma's vault list: ${vault.contractId}`);
  }
}

/**
 * The router's swap call for a route, as the background signs it: the function, its arguments and post-conditions
 * as Clarity hex, and the input amount the person will confirm.
 */
export async function buildSwap(route: Route, sender: string) {
  const call = await buildSwapTransaction(new Router(), route, sender);
  return {
    contract: call.contract as string,
    functionName: call.functionName,
    args: call.functionArgs.map(arg => cvToHex(arg)),
    postConditions: call.postConditions.map(condition => postConditionToHex(condition as Parameters<typeof postConditionToHex>[0])),
    amountIn: String(route.amountIn),
  };
}
