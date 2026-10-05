// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';
import { fetchMetadata, type TokenCacheData } from '@repo/tokens';
import { fetchVaults, quoteVault, type Vault } from 'dexterity-sdk';
import { intentSigner } from '../blaze-signer';
import { effectsOf, STX, type DecodeDeps, type Effect } from './decode';
import { mempool } from './hiro';

/**
 * One shared reading of the mempool, decoded: every app and every wallet watching balances reads the same snapshot,
 * so the chain is asked once every few seconds however many people are watching. A transaction is decoded once
 * (a swap is priced when first seen) and reused for as long as it waits.
 */

/** A transaction waiting to be mined and what it will do */
export interface PendingTx {
    txid: string;
    /** When the network received it, unix ms */
    at: number;
    effects: StoredEffect[];
}

/** An Effect as JSON can carry it */
export type StoredEffect = Omit<Effect, 'amount' | 'min'> & { amount: string; min?: string };

interface Snapshot { at: number; txs: PendingTx[] }

const SNAPSHOT_KEY = 'balance-sheet:mempool';
/** How long a snapshot counts as current */
const FRESH_MS = 3_000;
const KEEP_MS = 10 * 60_000;

/** The token list and Charisma's pools change rarely: read them every ten minutes */
const LIST_MS = 10 * 60_000;
let tokens: { at: number; baseOf: Map<string, string> } | undefined;
let vaults: { at: number; byId: Map<string, Vault> } | undefined;

async function subnetBases(): Promise<Map<string, string>> {
    if (!tokens || Date.now() - tokens.at > LIST_MS) {
        const list: TokenCacheData[] = await fetchMetadata();
        if (!list.length) throw new Error("The token list came back empty, so Blaze subnets can't be recognised");
        const baseOf = new Map(list.filter(t => t.type === 'SUBNET' && t.base).map(t => [t.contractId, t.base === 'stx' ? STX : t.base!]));
        tokens = { at: Date.now(), baseOf };
    }
    return tokens.baseOf;
}

async function vaultsById(): Promise<Map<string, Vault>> {
    if (!vaults || Date.now() - vaults.at > LIST_MS) {
        vaults = { at: Date.now(), byId: new Map((await fetchVaults()).map(v => [v.contractId, v])) };
    }
    return vaults.byId;
}

/** Decoding against Charisma's live token list and pools */
export async function liveDeps(): Promise<DecodeDeps> {
    const [baseOf, byId] = await Promise.all([subnetBases(), vaultsById()]);
    return {
        baseOf: id => baseOf.get(id),
        vault: id => byId.get(id),
        quote: async (vault, amount, opcode) => {
            const delta = await quoteVault(vault, Number(amount), opcode);
            return delta ? BigInt(Math.floor(delta.dy)) : null;
        },
        signer: intentSigner,
    };
}

const store = ({ amount, min, ...rest }: Effect): StoredEffect => ({ ...rest, amount: amount.toString(), ...(min !== undefined && { min: min.toString() }) });

/** The mempool, decoded: from the shared snapshot while it's fresh, otherwise read again (reusing what's decoded) */
export async function pendingTxs(): Promise<PendingTx[]> {
    const kept = (await kv.get(SNAPSHOT_KEY)) as Snapshot | null;
    if (kept && Date.now() - kept.at < FRESH_MS) return kept.txs;

    const [txs, deps] = await Promise.all([mempool(), liveDeps()]);
    const known = new Map((kept?.txs ?? []).map(tx => [tx.txid, tx]));
    const decoded = await Promise.all(txs.map(async (tx): Promise<PendingTx> => {
        const already = known.get(tx.tx_id);
        if (already) return already;
        try {
            return { txid: tx.tx_id, at: tx.receipt_time * 1000, effects: (await effectsOf(tx, deps)).map(store) };
        } catch (error) {
            // One unreadable transaction shouldn't hide the rest: it settles into the balance when its block lands
            console.error(`[balance-sheet] Couldn't decode ${tx.tx_id}: ${(error as Error).message}`);
            return { txid: tx.tx_id, at: tx.receipt_time * 1000, effects: [] };
        }
    }));
    await kv.set(SNAPSHOT_KEY, { at: Date.now(), txs: decoded } satisfies Snapshot, { px: KEEP_MS });
    return decoded;
}
