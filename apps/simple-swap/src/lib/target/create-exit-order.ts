import { signTriggeredSwap } from 'blaze-sdk';
import { SIGNER_PAYOUT_ROUTER, type LimitOrder, type NewOrderRequest } from '@/lib/orders/types';

/** One exit of a Target & Safety Net trade: sell `from` (subnet) into `to` when from/to crosses a ratio. */
export interface ExitOrderSpec {
  wallet: string;
  strategyId: string;
  role: 'target' | 'safety';
  /** Subnet contract the funds come from */
  fromSubnet: string;
  /** Mainnet contract of the held token (the condition token) */
  fromToken: string;
  /** Token paid out to the wallet, and the base the ratio is priced in */
  toToken: string;
  /** Smallest units of `from` */
  amount: bigint;
  /** from/to ratio that triggers this exit */
  ratio: number;
  direction: 'gt' | 'lt';
  /** Shown in Orders: the ratio when the trade started and the chosen move */
  entryRatio: number;
  movePct: number;
}

/** A ratio as the order API wants it: plain decimal, at most 18 places, never zero */
function ratioString(ratio: number): string {
  const text = ratio.toFixed(18).replace(/\.?0+$/, '');
  if (!/^\d+(\.\d{1,18})?$/.test(text) || Number(text) <= 0) {
    throw new Error(`Can't express a trigger of ${ratio}: the price ratio is too small for an order`);
  }
  return text;
}

/**
 * Sign one exit with the wallet and submit it. Both exits of a trade share the strategy id and
 * metadata.oco, so when one runs the executor cancels the other (they spend the same funds).
 */
export async function createExitOrder(spec: ExitOrderSpec): Promise<LimitOrder> {
  if (spec.amount <= 0n) throw new Error('Amount must be more than zero');
  const uuid = crypto.randomUUID();
  const signature = await signTriggeredSwap({ subnet: spec.fromSubnet, uuid, amount: spec.amount, multihopContractId: SIGNER_PAYOUT_ROUTER });

  const payload: NewOrderRequest = {
    owner: spec.wallet,
    inputToken: spec.fromSubnet,
    outputToken: spec.toToken,
    amountIn: spec.amount.toString(),
    conditionToken: spec.fromToken,
    baseAsset: spec.toToken,
    targetPrice: ratioString(spec.ratio),
    direction: spec.direction,
    recipient: spec.wallet,
    router: SIGNER_PAYOUT_ROUTER,
    signature,
    uuid,
    strategyId: spec.strategyId,
    strategyType: 'target',
    strategySize: 2,
    strategyPosition: spec.role === 'target' ? 1 : 2,
    metadata: { oco: true, target: { role: spec.role, entryRatio: spec.entryRatio, movePct: spec.movePct } },
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
