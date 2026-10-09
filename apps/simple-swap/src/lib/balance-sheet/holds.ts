// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';
import { activeOrders, isExit } from '../orders/active';
import { orderHandle } from '../orders/public';
import type { LimitOrder } from '../orders/types';
import type { BalanceEntry } from './types';

/**
 * Money promised to signed intents that haven't run: Swap's orders and Meme Roulette's bets. Signing doesn't lock
 * anything on the chain, so these are holds on the wallet's balance until they run (then the transaction takes over),
 * get cancelled, or the round is called off.
 */

/** A hold, and when its transaction was sent if it has been (the sheet checks those against the chain) */
export type Hold = BalanceEntry & { sentAt?: number };

/** A signed order in a few words, e.g. "DCA buy 2 of 5" */
export function noteOf(o: LimitOrder): string {
    if (o.strategyType === 'dca') return `DCA buy ${o.strategyPosition ?? '?'} of ${o.strategySize ?? '?'}`;
    if (o.strategyType === 'zesty') return 'Zesty';
    if (o.strategyType === 'in-and-out') return 'In & Out';
    if (o.strategyType === 'range') return 'Range order';
    if (o.strategyType === 'twitter') return 'Tweet trigger';
    return o.targetPrice ? 'Limit order' : 'Order';
}

/**
 * Holds for the owner's orders. Exits of one trade (a target and its safety net) spend the same funds and only one can
 * run, so the group holds its largest amount once; the others show at zero.
 */
export async function orderHolds(owner: string): Promise<Hold[]> {
    const orders = await activeOrders(owner);

    const counted = new Set<string>();
    const largestExit = new Map<string, LimitOrder>();
    for (const o of orders.filter(isExit)) {
        const group = `${o.strategyId}:${o.inputToken}`;
        const best = largestExit.get(group);
        if (!best || BigInt(o.amountIn) > BigInt(best.amountIn)) largestExit.set(group, o);
    }
    for (const o of largestExit.values()) counted.add(o.uuid);

    return orders.map((o): Hold => {
        const shared = isExit(o) && !counted.has(o.uuid);
        return {
            id: `order:${orderHandle(o.uuid)}`,
            token: o.inputToken,
            stage: 'hold',
            kind: 'order',
            amount: shared ? '0' : (-BigInt(o.amountIn)).toString(),
            order: orderHandle(o.uuid),
            note: shared ? `${noteOf(o)}, paid from the same funds as its other exit` : noteOf(o),
            ...(o.txid && { txid: o.txid, sentAt: o.broadcastedAt ? Date.parse(o.broadcastedAt) : Date.now() }),
            at: Date.parse(o.createdAt),
        };
    });
}

// Meme Roulette's store (apps/meme-roulette/src/lib/roulette/store.ts): all Charisma apps share one KV
const ROULETTE = {
    current: 'roulette:v2:current',
    history: 'roulette:v2:history',
    round: (id: string) => `roulette:v2:round:${id}`,
    bets: (id: string) => `roulette:v2:round:${id}:bets`,
};
/** Bets placed before Blaze v2 carry no subnet: they all spent CHA's v1 subnet */
const CHA_SUBNET_V1 = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1';

interface Bet { uuid: string; user: string; subnet?: string; amount: string; status: string; placedAt: number; txid?: string; sentAt?: number }

const parse = <T>(v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v) as T;

/** Holds for the user's bets in the live round and any drawn round still paying out */
export async function betHolds(user: string): Promise<Hold[]> {
    const [current, recent] = await Promise.all([
        kv.get<string>(ROULETTE.current),
        kv.zrange<string[]>(ROULETTE.history, 0, 2, { rev: true }),
    ]);
    const ids = [...new Set([current, ...recent].filter((id): id is string => !!id))];
    const holds = await Promise.all(ids.map(async id => {
        const [round, bets] = await Promise.all([
            kv.get<{ status: string }>(ROULETTE.round(id)),
            kv.hgetall<Record<string, unknown>>(ROULETTE.bets(id)),
        ]);
        // A called-off round spends nothing
        if (!round || round.status === 'void') return [];
        return Object.values(bets ?? {}).map(v => parse<Bet>(v))
            .filter(b => b.user === user && (b.status === 'placed' || b.status === 'sending' || (b.status === 'sent' && !!b.txid)))
            .map((b): Hold => ({
                id: `bet:${id}:${orderHandle(b.uuid)}`,
                token: b.subnet ?? CHA_SUBNET_V1,
                stage: 'hold',
                kind: 'bet',
                amount: (-BigInt(b.amount)).toString(),
                note: 'Meme Roulette bet',
                ...(b.txid && { txid: b.txid, sentAt: b.sentAt ?? Date.now() }),
                at: b.placedAt,
            }));
    }));
    return holds.flat();
}
