import { signTriggeredSwap } from 'blaze-sdk';
import { request } from '@stacks/connect';
import { Cl, Pc } from '@stacks/transactions';
import type { TokenCacheData } from '@/lib/contract-registry-adapter';
import { SIGNER_PAYOUT_ROUTER, type LimitOrder, type NewOrderRequest } from '@/lib/orders/types';

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

/** Sign one buy with the wallet and submit it; it runs as soon as its window opens. */
export async function placeDcaBuy(spec: DcaBuySpec): Promise<LimitOrder> {
  const uuid = crypto.randomUUID();
  const signature = await signTriggeredSwap({ subnet: spec.fromSubnet, uuid, amount: spec.amount, multihopContractId: SIGNER_PAYOUT_ROUTER });

  const payload: NewOrderRequest = {
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

  const res = await fetch('/api/v1/orders/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(`Buy ${spec.position} was not accepted: ${body.error ?? res.status}`);
  }
  return ((await res.json()) as { data: LimitOrder }).data;
}

/** Move a token from the wallet onto the subnet, where the buys spend it. Returns the txid. */
export async function depositToSubnet(wallet: string, token: TokenCacheData, subnet: string, amount: bigint): Promise<string> {
  if (!token.identifier) throw new Error(`${token.symbol} has no asset name in the token list, so it can't be moved safely`);
  const result = await request('stx_callContract', {
    contract: subnet as `${string}.${string}`,
    functionName: 'deposit',
    functionArgs: [Cl.uint(amount), Cl.none()],
    postConditionMode: 'deny',
    network: 'mainnet',
    postConditions: [Pc.principal(wallet).willSendEq(amount).ft(token.contractId as `${string}.${string}`, token.identifier)],
  });
  if (!result?.txid) throw new Error(`Moving ${token.symbol} out of your wallet was not sent`);
  return result.txid;
}
