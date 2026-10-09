import type {
    AddressBalanceResponse,
    AddressTransactionsV2ListResponse,
    MempoolTransaction,
    MempoolTransactionListResponse,
    ServerStatusResponse,
    Transaction,
    TransactionList,
    TransactionResults,
} from '@stacks/stacks-blockchain-api-types';
import { Cl, ClarityType } from '@stacks/transactions';

/** The chain as Hiro serves it, with Charisma's API key. Every read throws a descriptive error rather than guessing. */

const HIRO = 'https://api.hiro.so';
const PAGE = 50;
/** Hiro's most events per read */
const EVENTS = 100;
/** The mempool rarely holds more than a few hundred transactions; past this, the oldest wait for their block */
const MAX_MEMPOOL = 400;

async function hiro<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${HIRO}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', ...(process.env.HIRO_API_KEY && { 'x-api-key': process.env.HIRO_API_KEY }) },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Couldn't read ${path.split('?')[0]} from the chain (Hiro ${res.status})`);
    return res.json() as Promise<T>;
}

/** The newest Stacks block's height */
export async function tipHeight(): Promise<number> {
    const status = await hiro<ServerStatusResponse>('/extended');
    if (!status.chain_tip) throw new Error('Hiro sent no chain tip');
    return status.chain_tip.block_height;
}

/** Every transaction waiting to be mined (up to MAX_MEMPOOL), newest first */
export async function mempool(): Promise<MempoolTransaction[]> {
    const first = await hiro<MempoolTransactionListResponse>(`/extended/v1/tx/mempool?limit=${PAGE}`);
    const pages = Math.ceil(Math.min(first.total, MAX_MEMPOOL) / PAGE);
    const rest = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
            hiro<MempoolTransactionListResponse>(`/extended/v1/tx/mempool?limit=${PAGE}&offset=${(i + 1) * PAGE}`)),
    );
    // A transaction mined between pages can shift one onto two pages
    const seen = new Set<string>();
    return [first, ...rest].flatMap(page => page.results).filter(tx => !seen.has(tx.tx_id) && !!seen.add(tx.tx_id));
}

/** Every transaction mined in one block, with its token events */
export async function blockTransactions(height: number): Promise<Transaction[]> {
    const first = await hiro<TransactionResults>(`/extended/v2/blocks/${height}/transactions?limit=${PAGE}`);
    const rest = await Promise.all(
        Array.from({ length: Math.max(0, Math.ceil(first.total / PAGE) - 1) }, (_, i) =>
            hiro<TransactionResults>(`/extended/v2/blocks/${height}/transactions?limit=${PAGE}&offset=${(i + 1) * PAGE}`)),
    );
    return [first, ...rest].flatMap(page => page.results);
}

/** A page of the mined transactions an address sent or was part of (any token moving to or from it), newest first */
export async function addressTransactions(address: string, offset: number, limit: number): Promise<AddressTransactionsV2ListResponse> {
    return hiro<AddressTransactionsV2ListResponse>(`/extended/v2/addresses/${address}/transactions?limit=${limit}&offset=${offset}`);
}

/** Mined transactions by id, in the order asked, each with every one of its events */
export async function minedTransactions(txids: string[]): Promise<Transaction[]> {
    if (!txids.length) return [];
    const list = await hiro<TransactionList>(`/extended/v1/tx/multiple?${txids.map(id => `tx_id=${id}`).join('&')}&event_limit=${EVENTS}`);
    return Promise.all(txids.map(async id => {
        const found = list[id];
        if (!found?.found || !('block_height' in found.result)) throw new Error(`Hiro has no mined transaction ${id}`);
        const tx = found.result;
        // A busy transaction (an airdrop, a batch) logs more events than one read returns: read the rest at once
        const first = tx.events.length;
        const rest = await Promise.all(Array.from({ length: Math.ceil((tx.event_count - first) / EVENTS) }, (_, i) =>
            hiro<Transaction>(`/extended/v1/tx/${id}?event_offset=${first + i * EVENTS}&event_limit=${EVENTS}`)));
        tx.events.push(...rest.flatMap(more => more.events));
        if (tx.events.length < tx.event_count) throw new Error(`Hiro sent ${tx.events.length} of ${id}'s ${tx.event_count} events`);
        return tx;
    }));
}

/** A transaction by id, mined or waiting; null when Hiro hasn't seen it */
export async function transaction(txid: string): Promise<Transaction | MempoolTransaction | null> {
    try {
        return await hiro<Transaction | MempoolTransaction>(`/extended/v1/tx/${txid}`);
    } catch (error) {
        if ((error as Error).message.endsWith('(Hiro 404)')) return null;
        throw error;
    }
}

/** STX (less any stacked, locked STX) and every SIP-10 token an address holds, smallest units, keyed by contract (STX as ".stx") */
export async function walletBalances(address: string): Promise<Record<string, string>> {
    const data = await hiro<AddressBalanceResponse>(`/extended/v1/address/${address}/balances`);
    // Stacked STX is locked until its cycle ends: it isn't there to use
    const balances: Record<string, string> = { '.stx': (BigInt(data.stx.balance) - BigInt(data.stx.locked)).toString() };
    for (const [asset, ft] of Object.entries(data.fungible_tokens)) {
        if (ft && ft.balance !== '0') balances[asset.split('::')[0]] = ft.balance;
    }
    return balances;
}

/** An address's balance on one Blaze subnet, read from the subnet's map (subnet balances aren't SIP-10 tokens) */
export async function subnetBalance(subnet: string, address: string): Promise<string> {
    const [contractAddress, contractName] = subnet.split('.');
    const read = await hiro<{ okay: boolean; result?: string; cause?: string }>(
        `/v2/contracts/call-read/${contractAddress}/${contractName}/get-balance`,
        { method: 'POST', body: JSON.stringify({ sender: address, arguments: [Cl.serialize(Cl.principal(address))] }) },
    );
    if (!read.okay || !read.result) throw new Error(`${subnet} get-balance failed: ${read.cause ?? 'no result'}`);
    const value = Cl.deserialize(read.result);
    // v2 subnets answer (ok uint), v1 subnets a bare uint
    const inner = value.type === ClarityType.ResponseOk ? value.value : value;
    if (inner.type !== ClarityType.UInt) throw new Error(`${subnet} get-balance returned ${inner.type}, not a uint`);
    return BigInt(inner.value).toString();
}
