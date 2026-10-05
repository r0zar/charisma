// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';
import type { ConfirmedTx, FailedTx } from './types';

/**
 * Transactions that just finished for a wallet: confirmed (settled into the balance) or failed/dropped (snapped back).
 * The sheet reports them for a few minutes, so a screen can say "your swap confirmed" in the same moment its balance
 * settles. Written when a pending transaction leaves the mempool, and from every new block for watched wallets.
 */

const confirmedKey = (address: string) => `balance-sheet:confirmed:${address}`;
const failedKey = (address: string) => `balance-sheet:failed:${address}`;
const KEEP_S = 600;
const SHOWN_MS = 5 * 60_000;

async function note(key: string, txs: (ConfirmedTx | FailedTx)[]): Promise<void> {
    if (!txs.length) return;
    await kv.hset(key, Object.fromEntries(txs.map(tx => [tx.txid, tx])));
    await kv.expire(key, KEEP_S);
}

export const noteConfirmed = (address: string, txs: ConfirmedTx[]) => note(confirmedKey(address), txs);
export const noteFailed = (address: string, txs: FailedTx[]) => note(failedKey(address), txs);

/** What finished for this wallet in the last few minutes, newest first */
export async function recentlyFinished(address: string): Promise<{ confirmed: ConfirmedTx[]; failed: FailedTx[] }> {
    const [confirmed, failed] = await Promise.all([
        kv.hgetall<Record<string, ConfirmedTx>>(confirmedKey(address)),
        kv.hgetall<Record<string, FailedTx>>(failedKey(address)),
    ]);
    const recent = <T extends { at: number }>(map: Record<string, T> | null) =>
        Object.values(map ?? {}).filter(tx => Date.now() - tx.at < SHOWN_MS).sort((a, b) => b.at - a.at);
    return { confirmed: recent(confirmed), failed: recent(failed) };
}
