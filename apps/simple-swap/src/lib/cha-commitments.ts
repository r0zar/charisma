import { CHA_SUBNET_V1, CHA_SUBNET_V2, chaPlan, isChaSubnet } from './cha-subnets';

/** Orders that will still take from their subnet balance: waiting to run, or sent and not yet confirmed */
const SPENDING = ['open', 'broadcasted'];

/**
 * Subnet CHA the owner's orders will still spend, per subnet. They take it from that subnet's balance later,
 * so this much of it isn't free for anything else.
 */
export async function chaCommittedByOpenOrders(owner: string): Promise<Record<string, bigint>> {
    const res = await fetch(`/api/v1/orders?owner=${encodeURIComponent(owner)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not read your open orders (${res.status})`);
    const { data } = (await res.json()) as { data?: { inputToken: string; amountIn: string; status: string }[] };
    const committed: Record<string, bigint> = { [CHA_SUBNET_V1]: 0n, [CHA_SUBNET_V2]: 0n };
    for (const order of data ?? []) {
        if (SPENDING.includes(order.status) && order.inputToken in committed) committed[order.inputToken] += BigInt(order.amountIn);
    }
    return committed;
}

/** What's free in one CHA subnet once open orders are counted */
export const freeOf = (balance: number, committed: bigint) => {
    const held = BigInt(Math.floor(balance));
    return held > committed ? held - committed : 0n;
};

/** chaPlan for right now: the owner's exact v1 and v2 balances, less what their open orders still spend */
export async function chaPlanNow(owner: string, amount: bigint, balanceV1: number, balanceV2: number, wallet = 0n) {
    const committed = await chaCommittedByOpenOrders(owner);
    return chaPlan(amount, freeOf(balanceV1, committed[CHA_SUBNET_V1]), freeOf(balanceV2, committed[CHA_SUBNET_V2]), wallet);
}

/** The subnet that pays `amount` of `subnet` for `owner` right now: CHA picks v1 or v2 (old first), others pay for themselves */
export async function payingSubnet(subnet: string, owner: string, amount: bigint, balanceOf: (subnet: string) => number): Promise<string> {
    if (!isChaSubnet(subnet)) return subnet;
    return (await chaPlanNow(owner, amount, balanceOf(CHA_SUBNET_V1), balanceOf(CHA_SUBNET_V2))).source;
}
