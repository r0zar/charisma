import { signTriggeredSwap } from 'blaze-sdk';
import { SIGNER_PAYOUT_ROUTER, type NewOrderRequest, type PublicOrder } from '@/lib/orders/types';
import { SUBNET_PAIRS, type SubnetPair } from './subnet-pairs';
import { committedByOpenOrders, freeOf } from './subnet-commitments';

/** Per pair, the Blaze v1 balance that can move now: the v1 balance less what open v1 orders still spend */
export async function upgradableBalances(owner: string, balanceOf: (subnet: string) => number): Promise<Record<string, bigint>> {
    const committed = await committedByOpenOrders(owner);
    return Object.fromEntries(SUBNET_PAIRS.map(p => [p.v1, freeOf(balanceOf(p.v1), committed[p.v1])]));
}

/**
 * Upgrade to Blaze v2: one signed, immediate order that moves `amount` of a pair's v1 balance into v2 (out through
 * the v1 sublink, in through the v2 sublink, 1:1). The order executor runs immediate orders within about a minute
 * and pays the fee.
 */
export async function upgradeToV2(owner: string, pair: SubnetPair, amount: bigint): Promise<PublicOrder> {
    if (amount <= 0n) throw new Error(`There is no free Blaze v1 ${pair.symbol} to upgrade`);
    const uuid = crypto.randomUUID();
    const signature = await signTriggeredSwap({ subnet: pair.v1, uuid, amount, multihopContractId: SIGNER_PAYOUT_ROUTER });
    const order: NewOrderRequest = {
        owner,
        inputToken: pair.v1,
        outputToken: pair.v2,
        amountIn: amount.toString(),
        conditionToken: '*',
        targetPrice: '0',
        direction: 'gt',
        recipient: owner,
        router: SIGNER_PAYOUT_ROUTER,
        signature,
        uuid,
        strategyDescription: `Upgrade ${pair.symbol} to Blaze v2`,
    };
    const res = await fetch('/api/v1/orders/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(`The upgrade was not accepted: ${body.error ?? res.status}`);
    }
    return ((await res.json()) as { data: PublicOrder }).data;
}
