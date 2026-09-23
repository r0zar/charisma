import { signTriggeredSwap } from 'blaze-sdk';
import { convertToMicroUnits } from '@/lib/swap-utils';
import type { RangeLegSpec, RangeSettings } from './types';

export interface RangeRun {
  strategyId: string;
  strategySize: number;
  range: RangeSettings;
}

/**
 * Sign one leg of a range swap with the wallet and submit it as a triggered order.
 * Takes explicit tokens and condition, so it never depends on the swap card's state.
 */
export async function createRangeLeg(walletAddress: string, leg: RangeLegSpec, run: RangeRun): Promise<unknown> {
  if (!walletAddress) throw new Error('Connect wallet');

  const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();
  const micro = convertToMicroUnits(leg.amountDisplay, leg.inputDecimals);
  const signature = await signTriggeredSwap({ subnet: leg.inputToken, uuid, amount: BigInt(micro) });

  const payload = {
    owner: walletAddress,
    inputToken: leg.inputToken,
    outputToken: leg.outputToken,
    amountIn: micro,
    conditionToken: leg.conditionToken,
    baseAsset: leg.baseAsset,
    targetPrice: leg.targetPrice,
    direction: leg.direction,
    recipient: walletAddress,
    signature,
    uuid,
    validFrom: leg.validFrom,
    validTo: leg.validTo,
    strategyId: run.strategyId,
    strategyType: 'range',
    strategySize: run.strategySize,
    strategyPosition: leg.position,
    leg: leg.leg,
    metadata: { range: run.range },
  };

  const res = await fetch('/api/v1/orders/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({ error: 'unknown' }));
    throw new Error(j.error || `Order create failed (${res.status})`);
  }
  return res.json();
}
