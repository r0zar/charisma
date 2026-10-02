import { signTriggeredSwap } from 'blaze-sdk';
import { request } from '@stacks/connect';
import { buildSwapTransaction, Router } from 'dexterity-sdk';
import { getQuote } from '@/app/actions';
import { SWAP_COST } from '@/lib/zesty/plan';
import { SIGNER_PAYOUT_ROUTER, type LimitOrder, type NewOrderRequest } from '@/lib/orders/types';

export type InAndOutRole = 'buy' | 'target' | 'safety';

/** When an exit runs: `token` priced in `base` crosses `ratio` */
export interface ExitTrigger {
  token: string;
  base: string;
  ratio: number;
  direction: 'gt' | 'lt';
}

/** One order of an In & Out trade */
export interface InAndOutOrderSpec {
  wallet: string;
  strategyId: string;
  /** How many orders the trade has (buy + target, plus the safety net when on) */
  strategySize: number;
  role: InAndOutRole;
  /** Subnet contract the funds come from */
  inputSubnet: string;
  /** Token paid out */
  outputToken: string;
  /** Smallest units of the input */
  amount: bigint;
  /** No trigger: runs right away (the buy) */
  trigger?: ExitTrigger;
  /** Shown in Orders: the price when the trade started and the chosen move */
  entryRatio: number;
  movePct: number;
}

const ROLE_POSITION: Record<InAndOutRole, number> = { buy: 1, target: 2, safety: 3 };

/** A ratio as the order API wants it: plain decimal, at most 18 places, never zero */
function ratioString(ratio: number): string {
  const text = ratio.toFixed(18).replace(/\.?0+$/, '');
  if (!/^\d+(\.\d{1,18})?$/.test(text) || Number(text) <= 0) {
    throw new Error(`Can't express a trigger of ${ratio}: the price ratio is too small for an order`);
  }
  return text;
}

/**
 * Sign one order with the wallet and submit it. The exits share the strategy id and metadata.oco,
 * so when one runs the executor cancels the other (they spend the same tokens).
 */
export async function placeInAndOutOrder(spec: InAndOutOrderSpec): Promise<LimitOrder> {
  if (spec.amount <= 0n) throw new Error('Amount must be more than zero');
  const uuid = crypto.randomUUID();
  const signature = await signTriggeredSwap({ subnet: spec.inputSubnet, uuid, amount: spec.amount, multihopContractId: SIGNER_PAYOUT_ROUTER });

  const condition = spec.trigger
    ? { conditionToken: spec.trigger.token, baseAsset: spec.trigger.base, targetPrice: ratioString(spec.trigger.ratio), direction: spec.trigger.direction }
    : { conditionToken: '*', targetPrice: '0', direction: 'gt' as const };

  const payload: NewOrderRequest = {
    owner: spec.wallet,
    inputToken: spec.inputSubnet,
    outputToken: spec.outputToken,
    amountIn: spec.amount.toString(),
    ...condition,
    recipient: spec.wallet,
    router: SIGNER_PAYOUT_ROUTER,
    signature,
    uuid,
    strategyId: spec.strategyId,
    strategyType: 'in-and-out',
    strategySize: spec.strategySize,
    strategyPosition: ROLE_POSITION[spec.role],
    metadata: { oco: spec.role !== 'buy', inAndOut: { role: spec.role, entryRatio: spec.entryRatio, movePct: spec.movePct } },
  };

  const res = await fetch('/api/v1/orders/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(`The ${spec.role} order was not accepted: ${body.error ?? res.status}`);
  }
  return ((await res.json()) as { data: LimitOrder }).data;
}

/**
 * How much of `toSubnet` buying with `amount` of `fromSubnet` delivers at worst, after the executor's
 * slippage. The exits are signed for this, so they always fit what the buy delivers.
 */
export async function boughtAmount(fromSubnet: string, toSubnet: string, amount: bigint): Promise<bigint> {
  const quote = await getQuote(fromSubnet, toSubnet, amount.toString());
  if (!quote.success || !quote.data || quote.data instanceof Error || !quote.data.amountOut) {
    throw new Error(`No route to buy with this token right now: ${quote.error ?? 'empty quote'}`);
  }
  const out = BigInt(Math.floor(quote.data.amountOut * (1 - SWAP_COST)));
  if (out <= 0n) throw new Error('This amount buys too little to sell back later. Try a larger amount.');
  return out;
}

/** Slippage the wallet swap allows; the exits are sized to what it delivers at worst */
const WALLET_SLIPPAGE = 0.02;

/**
 * Buy straight from the wallet: one transaction swaps `payToken` into the bought token's subnet version.
 * Its link contract credits whoever sends the transaction, so the purchase lands on the subnet, ready
 * for the exits. Returns the txid and the least it delivers.
 */
export async function buyFromWallet(wallet: string, payToken: string, buySubnet: string, amount: bigint): Promise<{ txid: string; bought: bigint }> {
  const quote = await getQuote(payToken, buySubnet, amount.toString());
  if (!quote.success || !quote.data || quote.data instanceof Error || !quote.data.amountOut) {
    throw new Error(`No route to buy with this token right now: ${quote.error ?? 'empty quote'}`);
  }
  const bought = BigInt(Math.floor(quote.data.amountOut * (1 - WALLET_SLIPPAGE)));
  if (bought <= 0n) throw new Error('This amount buys too little to sell back later. Try a larger amount.');
  const router = new Router({ maxHops: 4, defaultSlippage: WALLET_SLIPPAGE, routerContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop' });
  const result = await request('stx_callContract', { ...(await buildSwapTransaction(router, quote.data, wallet)), address: wallet, network: 'mainnet' });
  if (!result?.txid) throw new Error('The purchase was not sent from your wallet');
  return { txid: result.txid, bought };
}
