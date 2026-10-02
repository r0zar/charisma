import { signTriggeredSwap } from 'blaze-sdk';
import { SIGNER_PAYOUT_ROUTER, type NewOrderRequest, type PublicOrder } from '@/lib/orders/types';
import { CHA_SUBNET_V1, CHA_SUBNET_V2 } from './cha-subnets';
import { chaCommittedByOpenOrders, freeOf } from './cha-commitments';

/** Blaze v1 CHA that can move now: the v1 balance less what open v1 orders still spend */
export async function upgradableCha(owner: string, balanceV1: number): Promise<bigint> {
    const committed = await chaCommittedByOpenOrders(owner);
    return freeOf(balanceV1, committed[CHA_SUBNET_V1]);
}

/**
 * Upgrade to Blaze v2: one signed, immediate order that moves `amount` of v1 CHA into v2 (out through the v1 sublink,
 * in through the v2 sublink, 1:1). The order executor runs immediate orders within about a minute and pays the fee.
 */
export async function upgradeChaToV2(owner: string, amount: bigint): Promise<PublicOrder> {
    if (amount <= 0n) throw new Error('There is no free Blaze v1 CHA to upgrade');
    const uuid = crypto.randomUUID();
    const signature = await signTriggeredSwap({ subnet: CHA_SUBNET_V1, uuid, amount, multihopContractId: SIGNER_PAYOUT_ROUTER });
    const order: NewOrderRequest = {
        owner,
        inputToken: CHA_SUBNET_V1,
        outputToken: CHA_SUBNET_V2,
        amountIn: amount.toString(),
        conditionToken: '*',
        targetPrice: '0',
        direction: 'gt',
        recipient: owner,
        router: SIGNER_PAYOUT_ROUTER,
        signature,
        uuid,
        strategyDescription: 'Upgrade to Blaze v2',
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
