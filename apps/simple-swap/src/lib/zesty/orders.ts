import { signTriggeredSwap, signedFetch } from 'blaze-sdk';
import { getQuote } from '@/app/actions';
import { SIGNER_PAYOUT_ROUTER, type LimitOrder, type NewOrderRequest } from '@/lib/orders/types';
import { ZESTY_TOKENS, type ZestyTokenKey } from './config';
import { SWAP_COST, type Exit, type Side } from './plan';

export type ZestyRole = 'convert' | 'target' | 'safety';

export interface ZestyOrderSpec {
  wallet: string;
  side: Side;
  strategyId: string;
  role: ZestyRole;
  from: ZestyTokenKey;
  to: ZestyTokenKey;
  micro: bigint;
  /** No exit: runs right away (the "convert now" step) */
  exit?: Exit;
  /** ZEST price and dollar size when the trade started, for display */
  entryPrice: number;
  amountUsd: number;
}

const ROLE_POSITION: Record<ZestyRole, number> = { convert: 1, target: 2, safety: 3 };

/** Sign one Zesty order in the wallet and submit it to the executor. */
export async function placeZestyOrder(spec: ZestyOrderSpec): Promise<LimitOrder> {
  const from = ZESTY_TOKENS[spec.from];
  const to = ZESTY_TOKENS[spec.to];
  const uuid = crypto.randomUUID();
  const signature = await signTriggeredSwap({ subnet: from.subnet, uuid, amount: spec.micro, multihopContractId: SIGNER_PAYOUT_ROUTER });

  const condition = spec.exit
    ? { conditionToken: ZESTY_TOKENS.zest.mainnet, targetPrice: spec.exit.price.toFixed(8), direction: spec.exit.direction }
    : { conditionToken: '*', targetPrice: '0', direction: 'gt' as const };

  const payload: NewOrderRequest = {
    owner: spec.wallet,
    inputToken: from.subnet,
    outputToken: to.subnet,
    amountIn: spec.micro.toString(),
    ...condition,
    recipient: spec.wallet,
    router: SIGNER_PAYOUT_ROUTER,
    signature,
    uuid,
    strategyId: spec.strategyId,
    strategyType: 'zesty',
    strategySize: 3,
    strategyPosition: ROLE_POSITION[spec.role],
    metadata: { zesty: { role: spec.role, side: spec.side, entryPrice: spec.entryPrice, amountUsd: spec.amountUsd } },
  };

  const res = await fetch('/api/v1/orders/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(`Zesty ${spec.role} order was not accepted: ${body.error ?? res.status}`);
  }
  return ((await res.json()) as { data: LimitOrder }).data;
}

/**
 * How much of `to` converting `micro` of `from` will deliver at worst, after the executor's slippage.
 * Exits are signed for this amount so they always fit what the conversion delivers.
 */
export async function convertedAmount(from: ZestyTokenKey, to: ZestyTokenKey, micro: bigint): Promise<bigint> {
  const quote = await getQuote(ZESTY_TOKENS[from].subnet, ZESTY_TOKENS[to].subnet, micro.toString());
  if (!quote.success || !quote.data || quote.data instanceof Error || !quote.data.amountOut) {
    throw new Error(`No route to convert ${ZESTY_TOKENS[from].symbol} into ${ZESTY_TOKENS[to].symbol}: ${quote.error ?? 'empty quote'}`);
  }
  return BigInt(Math.floor(quote.data.amountOut * (1 - SWAP_COST)));
}

/** Cancel orders in the wallet (one signature each); they stop and the money stays in Zesty. */
export async function cancelOrders(orders: LimitOrder[]): Promise<void> {
  for (const order of orders) {
    const res = await signedFetch(`/api/v1/orders/${order.uuid}/cancel`, { method: 'PATCH', message: order.uuid });
    if (!res.ok) throw new Error(`Could not cancel the trade (${res.status})`);
  }
}

/** Run an order right away instead of waiting for its price (one signature). */
export async function runNow(order: LimitOrder): Promise<void> {
  const res = await signedFetch(`/api/v1/orders/${order.uuid}/execute`, { method: 'POST', message: order.uuid });
  if (!res.ok) throw new Error(`Could not finish the trade now (${res.status})`);
}
