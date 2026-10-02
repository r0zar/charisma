import { pairOf, planSpend, type SubnetPair } from './subnet-pairs';

/** Orders that will still take from their subnet balance: waiting to run, or sent and not yet confirmed */
const SPENDING = ['open', 'broadcasted'];

/**
 * Subnet balance the owner's orders will still spend, per input subnet. They take it from that subnet's balance
 * later, so this much of it isn't free for anything else.
 */
export async function committedByOpenOrders(owner: string): Promise<Record<string, bigint>> {
    const res = await fetch(`/api/v1/orders?owner=${encodeURIComponent(owner)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not read your open orders (${res.status})`);
    const { data } = (await res.json()) as { data?: { inputToken: string; amountIn: string; status: string }[] };
    const committed: Record<string, bigint> = {};
    for (const order of data ?? []) {
        if (SPENDING.includes(order.status)) committed[order.inputToken] = (committed[order.inputToken] ?? 0n) + BigInt(order.amountIn);
    }
    return committed;
}

/** What's free in one subnet once open orders are counted */
export const freeOf = (balance: number, committed = 0n) => {
    const held = BigInt(Math.floor(balance));
    return held > committed ? held - committed : 0n;
};

/** planSpend for right now: the owner's exact v1 and v2 balances, less what their open orders still spend */
export async function planSpendNow(pair: SubnetPair, owner: string, amount: bigint, balanceV1: number, balanceV2: number, wallet = 0n) {
    const committed = await committedByOpenOrders(owner);
    return planSpend(pair, amount, freeOf(balanceV1, committed[pair.v1]), freeOf(balanceV2, committed[pair.v2]), wallet);
}

/** The subnet that pays `amount` of `subnet` for `owner` right now: a pair picks v1 or v2 (old first), others pay for themselves */
export async function payingSubnet(subnet: string, owner: string, amount: bigint, balanceOf: (subnet: string) => number): Promise<string> {
    const pair = pairOf(subnet);
    if (!pair) return subnet;
    return (await planSpendNow(pair, owner, amount, balanceOf(pair.v1), balanceOf(pair.v2))).source;
}
