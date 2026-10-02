import { canSignInBulk, signTriggeredSwap, signTriggeredSwaps } from 'blaze-sdk';
import { request } from '@stacks/connect';
import { Cl } from '@stacks/transactions';
import type { TokenCacheData } from '@/lib/contract-registry-adapter';
import { SIGNER_PAYOUT_ROUTER, type LimitOrder, type NewOrderRequest } from '@/lib/orders/types';
import { baseTokenLeaves } from '@/lib/subnet-deposit';

/** One buy of a DCA plan: swap `amount` of the subnet token into `to` any time inside its window */
export interface DcaBuySpec {
  wallet: string;
  strategyId: string;
  strategySize: number;
  position: number;
  fromSubnet: string;
  to: string;
  amount: bigint;
  validFrom: Date;
  validTo: Date;
}

/** The order the executor stores for one signed buy */
function buyOrder(spec: DcaBuySpec, uuid: string, signature: string): NewOrderRequest {
  return {
    owner: spec.wallet,
    inputToken: spec.fromSubnet,
    outputToken: spec.to,
    amountIn: spec.amount.toString(),
    conditionToken: '*',
    targetPrice: '0',
    direction: 'gt',
    validFrom: spec.validFrom.toISOString(),
    validTo: spec.validTo.toISOString(),
    recipient: spec.wallet,
    router: SIGNER_PAYOUT_ROUTER,
    signature,
    uuid,
    strategyId: spec.strategyId,
    strategyType: 'dca',
    strategySize: spec.strategySize,
    strategyPosition: spec.position,
  };
}

async function submit(order: NewOrderRequest): Promise<LimitOrder> {
  const res = await fetch('/api/v1/orders/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(`Buy ${order.strategyPosition} was not accepted: ${body.error ?? res.status}`);
  }
  return ((await res.json()) as { data: LimitOrder }).data;
}

/** Orders saved at once when many were signed together (each is checked on chain as it's saved) */
const SAVE_AT_ONCE = 6;

/**
 * Sign every buy and save it. Blaze Wallet signs them all from one approval; other wallets ask once per buy.
 * `onProgress` hears what's happening, for the button.
 */
export async function placeDcaBuys(specs: DcaBuySpec[], onProgress: (text: string) => void): Promise<void> {
  const uuids = specs.map(() => crypto.randomUUID());
  const count = specs.length.toLocaleString('en-US');

  if (!canSignInBulk()) {
    for (const [i, spec] of specs.entries()) {
      onProgress(`Sign buy ${i + 1} of ${count}…`);
      const signature = await signTriggeredSwap({ subnet: spec.fromSubnet, uuid: uuids[i], amount: spec.amount, multihopContractId: SIGNER_PAYOUT_ROUTER });
      await submit(buyOrder(spec, uuids[i], signature));
    }
    return;
  }

  onProgress(`Approve all ${count} buys in Blaze Wallet…`);
  const signatures = await signTriggeredSwaps(specs.map((spec, i) => ({ subnet: spec.fromSubnet, uuid: uuids[i], amount: spec.amount, multihopContractId: SIGNER_PAYOUT_ROUTER })));
  let saved = 0;
  for (let i = 0; i < specs.length; i += SAVE_AT_ONCE) {
    onProgress(`Saving your buys… ${saved.toLocaleString('en-US')} of ${count}`);
    await Promise.all(specs.slice(i, i + SAVE_AT_ONCE).map((spec, j) => submit(buyOrder(spec, uuids[i + j], signatures[i + j]))));
    saved = Math.min(i + SAVE_AT_ONCE, specs.length);
  }
}

/** Move a token from the wallet onto the subnet, where the buys spend it. Returns the txid. */
export async function depositToSubnet(wallet: string, token: TokenCacheData, subnet: string, amount: bigint): Promise<string> {
  const result = await request('stx_callContract', {
    address: wallet,
    contract: subnet as `${string}.${string}`,
    functionName: 'deposit',
    functionArgs: [Cl.uint(amount), Cl.none()],
    postConditionMode: 'deny',
    network: 'mainnet',
    postConditions: [baseTokenLeaves(wallet, token, amount)],
  });
  if (!result?.txid) throw new Error(`Moving ${token.symbol} out of your wallet was not sent`);
  return result.txid;
}
