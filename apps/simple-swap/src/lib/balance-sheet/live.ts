// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';
import type { Transaction } from '@stacks/stacks-blockchain-api-types';
import { changed, versions, watched, watching } from './changes';
import { effectsOf, type Effect } from './decode';
import { noteConfirmed, noteFailed } from './finished';
import { blockTransactions } from './hiro';
import { liveDeps, pendingTxs, store } from './mempool';
import { balanceSheet, entriesFor, tip } from './sheet';
import type { BalanceSheet } from './types';

/**
 * Live balances: screens hold a stream open, and each server instance runs one loop for all the streams it holds.
 * The loop keeps the shared mempool snapshot fresh, reads each new block's token events, and re-works a wallet's
 * balance sheet only when something touching that wallet changed (or every half minute, to be safe).
 */

const TICK_MS = 1_500;
/** Re-work every watched sheet at least this often, for changes nothing flagged */
const SAFETY_MS = 30_000;
/** How often an instance renews its wallets' place on the watched list */
const RENEW_TICKS = 10;
const MAINTAIN_LOCK = 'balance-sheet:maintain';
const LAST_BLOCK_KEY = 'balance-sheet:last-block';
/** A block scan never reaches back further than this (a quiet spell with nobody watching) */
const MAX_BLOCKS = 5;

export type Listener = { sheet(sheet: BalanceSheet): void; problem(message: string): void };

const listeners = new Map<string, Set<Listener>>();
const shown = new Map<string, { version: number | null; digest: string; at: number }>();
/** Wallets whose first sheet is still being read: the loop leaves them alone until it's sent */
const starting = new Set<string>();
let timer: ReturnType<typeof setInterval> | undefined;
let ticks = 0;
let busy = false;

/** What a screen sees, so an unchanged sheet isn't sent again */
const digestOf = (sheet: BalanceSheet) => JSON.stringify([sheet.tokens, sheet.failed.map(f => f.txid)]);

/** Wallets a mined transaction touched: its token events (any app), its fee payer, and Blaze subnet moves */
async function touchedBy(tx: Transaction, deps: Awaited<ReturnType<typeof liveDeps>>): Promise<{ addresses: string[]; effects: Effect[] }> {
    const addresses = [tx.sender_address, ...(tx.sponsor_address ? [tx.sponsor_address] : [])];
    let effects: Effect[] = [];
    for (const event of 'events' in tx ? tx.events : []) {
        if (event.event_type === 'stx_asset' || event.event_type === 'fungible_token_asset') {
            if (event.asset.sender) addresses.push(event.asset.sender);
            if (event.asset.recipient) addresses.push(event.asset.recipient);
        }
    }
    // Subnet balances live in a map, not a token, so they leave no token events: decoding finds them
    try {
        effects = await effectsOf(tx, { ...deps, quote: async () => null });
        for (const e of effects) addresses.push(e.address, ...(e.counterparty ? [e.counterparty] : []));
    } catch (error) {
        console.error(`[balance-sheet] Couldn't read ${tx.tx_id} in its block: ${(error as Error).message}`);
    }
    return { addresses, effects };
}

/** A watched wallet's transaction in a new block: confirmed, or failed (with what snapped back) */
async function finished(tx: Transaction, height: number, touched: { addresses: string[]; effects: Effect[] }, watch: Set<string>) {
    const mine = [...new Set(touched.addresses)].filter(a => watch.has(a));
    await Promise.all(mine.map(address => {
        if (tx.tx_status === 'success') return noteConfirmed(address, [{ txid: tx.tx_id, block: height, at: Date.now() }]);
        const pending = { txid: tx.tx_id, at: Date.now(), effects: touched.effects.map(store) };
        return noteFailed(address, [{ txid: tx.tx_id, status: tx.tx_status, at: Date.now(), entries: entriesFor([pending], address).get(tx.tx_id) ?? [] }]);
    }));
}

/** Flags watched wallets touched by blocks mined since the last scan */
async function scanBlocks(): Promise<void> {
    const height = await tip();
    const last = await kv.get<number>(LAST_BLOCK_KEY);
    await kv.set(LAST_BLOCK_KEY, height);
    if (last === null || height <= last) return;
    const watch = await watched();
    if (!watch.size) return;
    const deps = await liveDeps();
    for (let h = Math.max(last + 1, height - MAX_BLOCKS + 1); h <= height; h++) {
        const txs = await blockTransactions(h);
        const touched = await Promise.all(txs.map(tx => touchedBy(tx, deps)));
        // Say which transactions finished before the wallets re-work, so the same push carries both
        await Promise.all(txs.map((tx, i) => finished(tx, h, touched[i], watch)));
        await changed(touched.flatMap(t => t.addresses), watch);
    }
}

/** One instance at a time keeps the shared state fresh: the mempool snapshot and the block scan */
async function maintain(): Promise<void> {
    if ((await kv.set(MAINTAIN_LOCK, 1, { nx: true, px: TICK_MS })) !== 'OK') return;
    await pendingTxs();
    await scanBlocks();
}

async function tick(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
        const addresses = [...listeners.keys()];
        if (ticks++ % RENEW_TICKS === 0) await watching(addresses);
        await maintain();
        const current = await versions(addresses);
        await Promise.all(addresses.map(async (address, i) => {
            const last = shown.get(address);
            if (starting.has(address) || (last && last.version === current[i] && Date.now() - last.at < SAFETY_MS)) return;
            try {
                const sheet = await balanceSheet(address);
                const digest = digestOf(sheet);
                shown.set(address, { version: current[i], digest, at: Date.now() });
                if (last?.digest !== digest) for (const l of listeners.get(address) ?? []) l.sheet(sheet);
            } catch (error) {
                for (const l of listeners.get(address) ?? []) l.problem((error as Error).message);
            }
        }));
    } catch (error) {
        console.error('[balance-sheet] Live update failed:', error);
    } finally {
        busy = false;
    }
}

/** A new screen gets the sheet as it stands, then only changes */
async function first(address: string, listener: Listener): Promise<void> {
    const fresh = !shown.has(address);
    if (fresh) starting.add(address);
    try {
        const [version] = await versions([address]);
        const sheet = await balanceSheet(address);
        listener.sheet(sheet);
        if (fresh) shown.set(address, { version, digest: digestOf(sheet), at: Date.now() });
    } catch (error) {
        listener.problem((error as Error).message);
    } finally {
        if (fresh) starting.delete(address);
    }
}

/** Sends `address`'s sheet now and whenever it changes; returns the way to stop */
export function listen(address: string, listener: Listener): () => void {
    const set = listeners.get(address) ?? listeners.set(address, new Set()).get(address)!;
    set.add(listener);
    // A new wallet joins the watched list at once, so its changes are flagged from now on
    if (set.size === 1) void watching([address]).catch(error => console.error('[balance-sheet] watching:', error));
    void first(address, listener);
    timer ??= setInterval(() => void tick(), TICK_MS);
    return () => {
        set.delete(listener);
        if (!set.size) {
            listeners.delete(address);
            shown.delete(address);
        }
        if (!listeners.size && timer) {
            clearInterval(timer);
            timer = undefined;
        }
    };
}
