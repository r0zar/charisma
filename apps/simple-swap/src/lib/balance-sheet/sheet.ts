// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';
import { betHolds, orderHolds, type Hold } from './holds';
import { tipHeight, transaction } from './hiro';
import { pendingTxs, subnetBases, type PendingTx } from './mempool';
import { settledBalances } from './settled';
import type { BalanceEntry, BalanceSheet, FailedTx, TokenSheet } from './types';

/**
 * An address's instant balances: what the chain has settled, plus everything on its way (from the mempool) and
 * everything promised (signed orders and bets).
 *
 * A transaction leaving the mempool needs care, because the settled balance and the mempool are read moments apart.
 * The sheet remembers which transactions it showed as pending for this address. When one is gone, it asks the chain:
 * if the transaction landed in a block the settled balance doesn't include yet, it stays pending; if it failed or was
 * dropped, its entries snap back and it's reported in `failed`.
 */

const TIP_KEY = 'balance-sheet:tip';
const seenKey = (address: string) => `balance-sheet:seen:${address}`;
const failedKey = (address: string) => `balance-sheet:failed:${address}`;
const statusKey = (txid: string) => `balance-sheet:status:${txid}`;

/** How long a sent transaction Hiro can't find yet still counts (it can take a moment to show up) */
const UNSEEN_GRACE_MS = 60_000;
/** How long a failure stays on the sheet */
const FAILED_SHOWN_MS = 5 * 60_000;

interface Seen { at: number; entries: BalanceEntry[] }
interface TxStatus { status: string; block?: number }

/** The newest block, shared for a couple of seconds */
export async function tip(): Promise<number> {
    const kept = await kv.get<number>(TIP_KEY);
    if (kept) return kept;
    const height = await tipHeight();
    await kv.set(TIP_KEY, height, { px: 2_000 });
    return height;
}

/** A transaction's fate on the chain; final answers are kept, since they never change */
async function statusOf(txid: string): Promise<TxStatus> {
    const kept = await kv.get<TxStatus>(statusKey(txid));
    if (kept) return kept;
    const tx = await transaction(txid);
    if (!tx) return { status: 'not_found' };
    const block = 'block_height' in tx ? tx.block_height : undefined;
    const status: TxStatus = { status: tx.tx_status, ...(block !== undefined && { block }) };
    if (tx.tx_status !== 'pending') await kv.set(statusKey(txid), status, { ex: 3600 });
    return status;
}

/** What a status means for a pending change: still on its way, settled into the balance, or snapped back */
function fate(status: TxStatus, block: number, sentAt: number): 'pending' | 'settled' | 'failed' {
    if (status.status === 'pending') return 'pending';
    if (status.status === 'success') return status.block !== undefined && status.block > block ? 'pending' : 'settled';
    if (status.status === 'not_found') return Date.now() - sentAt < UNSEEN_GRACE_MS ? 'pending' : 'failed';
    return 'failed';
}

/** This address's side of each pending transaction, one entry per transaction, token and kind */
function entriesFor(txs: PendingTx[], address: string): Map<string, BalanceEntry[]> {
    const byTx = new Map<string, BalanceEntry[]>();
    for (const tx of txs) {
        const mine = new Map<string, BalanceEntry>();
        for (const e of tx.effects.filter(e => e.address === address)) {
            const id = `${tx.txid}:${e.token}:${e.kind}`;
            const same = mine.get(id);
            mine.set(id, same
                ? { ...same, amount: (BigInt(same.amount) + BigInt(e.amount)).toString() }
                : {
                    id, token: e.token, stage: 'pending', kind: e.kind, amount: e.amount, txid: tx.txid, at: tx.at,
                    ...(e.min !== undefined && { min: e.min }), ...(e.counterparty && { counterparty: e.counterparty }),
                });
        }
        const entries = [...mine.values()].filter(e => e.amount !== '0');
        if (entries.length) byTx.set(tx.txid, entries);
    }
    return byTx;
}

const sum = (entries: BalanceEntry[]) => entries.reduce((total, e) => total + BigInt(e.amount), 0n);

export async function balanceSheet(address: string): Promise<BalanceSheet> {
    const block = await tip();
    const [txs, orders, bets, seen] = await Promise.all([
        pendingTxs(),
        orderHolds(address),
        betHolds(address),
        kv.hgetall<Record<string, Seen>>(seenKey(address)).then(s => s ?? {}),
    ]);
    const inMempool = new Set(txs.map(tx => tx.txid));
    const pending = entriesFor(txs, address);

    // Remember what's shown as pending (fees alone can't snap back), so it can be followed once it leaves the mempool
    const fresh = [...pending].filter(([txid, entries]) => !seen[txid] && entries.some(e => e.kind !== 'fee'));
    if (fresh.length) {
        await kv.hset(seenKey(address), Object.fromEntries(fresh.map(([txid, entries]) => [txid, { at: Date.now(), entries }])));
        await kv.expire(seenKey(address), 900);
    }

    // Transactions that left the mempool since the last look
    const failed: FailedTx[] = [];
    const forget: string[] = [];
    // Tokens a just-settled transaction touched: read fresh, even a subnet the wallet didn't hold before
    const justSettled: string[] = [];
    await Promise.all(Object.entries(seen).filter(([txid]) => !inMempool.has(txid)).map(async ([txid, { at, entries }]) => {
        const status = await statusOf(txid);
        const outcome = fate(status, block, at);
        if (outcome === 'pending') return void pending.set(txid, entries);
        forget.push(txid);
        if (outcome === 'failed') failed.push({ txid, status: status.status, at: Date.now(), entries });
        else justSettled.push(...entries.map(e => e.token));
    }));
    if (forget.length) await kv.hdel(seenKey(address), ...forget);
    if (failed.length) {
        await kv.hset(failedKey(address), Object.fromEntries(failed.map(f => [f.txid, f])));
        await kv.expire(failedKey(address), 600);
    }

    // A sent order or bet whose transaction isn't in the mempool: keep its hold only while the chain hasn't ruled on it
    const holds = (await Promise.all([...orders, ...bets].map(async ({ sentAt, ...hold }: Hold) => {
        if (!hold.txid || sentAt === undefined) return hold;
        if (inMempool.has(hold.txid) || pending.has(hold.txid)) return null;
        return fate(await statusOf(hold.txid), block, sentAt) === 'pending' ? hold : null;
    }))).filter((h): h is BalanceEntry => h !== null);

    const entries = [...[...pending.values()].flat(), ...holds];
    const [settled, bases] = await Promise.all([
        settledBalances(address, block, [...new Set([...entries.map(e => e.token), ...justSettled])]),
        subnetBases(),
    ]);

    const tokens: Record<string, TokenSheet> = {};
    const ids = new Set([...Object.keys(settled.balances), ...Object.keys(settled.errors), ...entries.map(e => e.token)]);
    for (const token of ids) {
        const mine = entries.filter(e => e.token === token).sort((a, b) => a.at - b.at);
        const error = settled.errors[token];
        const onChain = error ? null : (settled.balances[token] ?? '0');
        const pendingSum = sum(mine.filter(e => e.stage === 'pending'));
        const held = sum(mine.filter(e => e.stage === 'hold'));
        const base = bases.get(token);
        tokens[token] = {
            ...(base && { base }),
            settled: onChain,
            ...(error && { error }),
            pending: pendingSum.toString(),
            held: held.toString(),
            ready: onChain === null ? null : (BigInt(onChain) + pendingSum + held).toString(),
            entries: mine,
        };
    }

    const recentFailures = Object.values((await kv.hgetall<Record<string, FailedTx>>(failedKey(address))) ?? {})
        .filter(f => Date.now() - f.at < FAILED_SHOWN_MS)
        .sort((a, b) => b.at - a.at);

    return { address, block, at: Date.now(), tokens, failed: recentFailures };
}
