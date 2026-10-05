// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';
import { fetchMetadata } from '@repo/tokens';
import { BLAZE_V2_SUBNETS } from 'blaze-sdk';
import { subnetBalance, walletBalances } from './hiro';

/**
 * What an address holds on the chain: its wallet (STX and SIP-10 tokens, one Hiro call) and its Blaze subnet balances
 * (one read per subnet, since subnet balances live in each subnet's own map). Reading every subnet for every watched
 * wallet on every block would run into Hiro's rate limit, so each block re-reads only the subnets the wallet holds or
 * is about to touch, and every few minutes all of them, to notice anything new.
 */

export interface Settled {
    /** Smallest units by contract; a token missing here (and from errors) is zero */
    balances: Record<string, string>;
    /** Subnets that couldn't be read, and why */
    errors: Record<string, string>;
}

interface SubnetCache {
    /** Block the subnets were last read at */
    block: number;
    /** When every subnet was last read */
    fullAt: number;
    /** Non-zero balances only */
    balances: Record<string, string>;
    /** Subnets whose last read failed, and why */
    errors: Record<string, string>;
}

const FULL_EVERY_MS = 5 * 60_000;
const walletKey = (address: string, block: number) => `balance-sheet:wallet:${address}:${block}`;
const subnetsKey = (address: string) => `balance-sheet:subnets:${address}`;

let subnetList: { at: number; ids: string[] } | undefined;

/** Every Blaze subnet: the token list's, plus Charisma's v2 subnets (a CDN copy of the list can lag behind them) */
async function allSubnets(): Promise<string[]> {
    if (!subnetList || Date.now() - subnetList.at > FULL_EVERY_MS) {
        const listed = (await fetchMetadata()).filter(t => t.type === 'SUBNET').map(t => t.contractId);
        subnetList = { at: Date.now(), ids: [...new Set([...listed, ...BLAZE_V2_SUBNETS])] };
    }
    return subnetList.ids;
}

/** A few reads at a time, each tried twice: a burst of ~40 at once makes Hiro time some out */
const BATCH = 8;
const twice = <T>(read: () => Promise<T>) => read().catch(() => read());

async function readSubnets(address: string, ids: string[], into: Record<string, string>, errors: Record<string, string>) {
    for (let i = 0; i < ids.length; i += BATCH) await Promise.all(ids.slice(i, i + BATCH).map(async id => {
        try {
            const balance = await twice(() => subnetBalance(id, address));
            if (balance === '0') delete into[id];
            else into[id] = balance;
        } catch (error) {
            // A subnet that couldn't be read keeps no balance: its error stands in for it
            delete into[id];
            errors[id] = (error as Error).message;
        }
    }));
}

/**
 * The address's settled balances at `block`. `touching` names subnets that pending changes, orders or bets involve,
 * so they're read fresh even if the wallet held none of them before.
 */
export async function settledBalances(address: string, block: number, touching: string[]): Promise<Settled> {
    const [wallet, cache, subnets] = await Promise.all([
        kv.get<Record<string, string>>(walletKey(address, block)).then(async kept => {
            if (kept) return kept;
            const read = await walletBalances(address);
            await kv.set(walletKey(address, block), read, { ex: 120 });
            return read;
        }),
        kv.get<SubnetCache>(subnetsKey(address)),
        allSubnets(),
    ]);

    // Balances only change when a block lands, so a subnet is read at most once per block
    let next = cache;
    if (!cache || Date.now() - cache.fullAt > FULL_EVERY_MS) {
        next = { block, fullAt: Date.now(), balances: {}, errors: {} };
        await readSubnets(address, subnets, next.balances, next.errors);
    } else if (cache.block < block) {
        const isSubnet = new Set(subnets);
        const reread = [...new Set([...Object.keys(cache.balances), ...Object.keys(cache.errors), ...touching.filter(id => isSubnet.has(id))])];
        next = { ...cache, block, balances: { ...cache.balances }, errors: {} };
        await readSubnets(address, reread, next.balances, next.errors);
    }
    if (next !== cache) await kv.set(subnetsKey(address), next, { ex: 3600 });

    return { balances: { ...wallet, ...next!.balances }, errors: next!.errors };
}
