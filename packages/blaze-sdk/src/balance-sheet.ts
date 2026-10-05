/**
 * Instant balances from Charisma's balance service: what an address holds on the chain, plus every change the chain
 * hasn't settled yet (transactions waiting to be mined, signed orders and bets), so a balance moves the moment someone
 * approves. The service reads the chain itself, so nothing has to be reported.
 *
 * Each token is one contract: STX (".stx"), a SIP-10 token, or a Blaze subnet. `combineSubnets` adds a token's Stacks
 * and Blaze sides together.
 */

/** Sent and waiting for a block (pending), or promised to a signed order or bet that hasn't run (hold) */
export type EntryStage = 'pending' | 'hold';

export type EntryKind = 'transfer' | 'swap' | 'deposit' | 'withdraw' | 'fee' | 'order' | 'bet';

/** One unsettled change to one token's balance */
export interface BalanceEntry {
    /** Stable across reads: `${txid}:${token}:${kind}`, `order:${handle}` or `bet:${round}:${handle}` */
    id: string;
    token: string;
    stage: EntryStage;
    kind: EntryKind;
    /** Signed, smallest units. A swap's output is its likely amount, from a live quote */
    amount: string;
    /** The least a swap's output can settle at, when its transaction guarantees one */
    min?: string;
    /** The other wallet in a transfer */
    counterparty?: string;
    txid?: string;
    /** The order's public handle (never its uuid) */
    order?: string;
    /** Readable detail, e.g. "DCA buy 2 of 5" */
    note?: string;
    /** When it started, unix ms */
    at: number;
}

export interface TokenSheet {
    /** A Blaze subnet's base token (".stx" for STX); absent for anything that isn't a subnet */
    base?: string;
    /** On the chain, smallest units; null when it couldn't be read (error says why) */
    settled: string | null;
    error?: string;
    /** Sum of the pending entries */
    pending: string;
    /** Sum of the holds (zero or negative) */
    held: string;
    /** settled + pending + held: negative when orders promise more than the wallet holds. Null when settled is */
    ready: string | null;
    entries: BalanceEntry[];
}

/** A transaction that failed or was dropped: its entries snapped back */
export interface FailedTx {
    txid: string;
    /** The chain's status, e.g. abort_by_post_condition or dropped_replace_by_fee */
    status: string;
    at: number;
    entries: BalanceEntry[];
}

export interface BalanceSheet {
    address: string;
    /** The Stacks block the settled balances were read at */
    block: number;
    at: number;
    tokens: Record<string, TokenSheet>;
    /** Failed or dropped in the last few minutes */
    failed: FailedTx[];
}

export interface BalanceServiceOptions {
    /** Defaults to Charisma's service */
    baseUrl?: string;
    fetch?: typeof fetch;
}

export const BALANCE_SERVICE_URL = 'https://swap.charisma.rocks';

const urlOf = (address: string, path: 'sheet' | 'stream', baseUrl = BALANCE_SERVICE_URL) =>
    `${baseUrl.replace(/\/$/, '')}/api/v1/balances/${encodeURIComponent(address)}/${path}`;

async function problemOf(res: Response): Promise<Error> {
    const body = await res.json().catch(() => undefined) as { message?: string } | undefined;
    return new Error(`Balances for this address couldn't be read (${res.status}): ${body?.message ?? res.statusText}`);
}

/** An address's balance sheet, once. Throws a descriptive error when the service can't read it */
export async function getBalances(address: string, options: BalanceServiceOptions = {}): Promise<BalanceSheet> {
    const res = await (options.fetch ?? fetch)(urlOf(address, 'sheet', options.baseUrl), { cache: 'no-store' });
    if (!res.ok) throw await problemOf(res);
    return res.json() as Promise<BalanceSheet>;
}

/** Server-sent events from a response body: each event's name (default "message") and data */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: string }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) return;
            buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
            let end: number;
            while ((end = buffer.indexOf('\n\n')) >= 0) {
                const block = buffer.slice(0, end);
                buffer = buffer.slice(end + 2);
                let event = 'message';
                const data: string[] = [];
                for (const line of block.split('\n')) {
                    if (line.startsWith('event:')) event = line.slice(6).trim();
                    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
                }
                if (data.length) yield { event, data: data.join('\n') };
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export interface WatchOptions extends BalanceServiceOptions {
    /** Called when balances couldn't be read or the connection dropped; watching carries on and reconnects */
    onProblem?: (error: Error) => void;
}

const pause = (ms: number, signal: AbortSignal) =>
    new Promise<void>(resolve => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    });

/**
 * Calls `onSheet` with the address's balance sheet now and again every time it changes, pushed by the service (no
 * polling). Reconnects on its own when the connection closes or drops. Returns a function that stops watching.
 * Works in browsers, extensions (service workers included) and Node 18+, since it reads the stream with fetch.
 */
export function watchBalances(address: string, onSheet: (sheet: BalanceSheet) => void, options: WatchOptions = {}): () => void {
    const stop = new AbortController();
    const { signal } = stop;
    void (async () => {
        let wait = 1_000;
        while (!signal.aborted) {
            try {
                const res = await (options.fetch ?? fetch)(urlOf(address, 'stream', options.baseUrl), {
                    signal, headers: { accept: 'text/event-stream' }, cache: 'no-store',
                });
                if (!res.ok || !res.body) throw await problemOf(res);
                wait = 1_000;
                for await (const { event, data } of readEvents(res.body)) {
                    if (event === 'sheet') onSheet(JSON.parse(data) as BalanceSheet);
                    else if (event === 'problem') options.onProblem?.(new Error((JSON.parse(data) as { message: string }).message));
                }
            } catch (error) {
                if (signal.aborted) return;
                options.onProblem?.(error instanceof Error ? error : new Error(String(error)));
                wait = Math.min(wait * 2, 30_000);
            }
            // The service closes each stream after a few minutes; a clean close reconnects within a second
            await pause(wait, signal);
        }
    })();
    return () => stop.abort();
}

/** A token's balances added up across Stacks and every Blaze subnet of it */
export interface CombinedBalance {
    settled: string | null;
    pending: string;
    held: string;
    ready: string | null;
    /** The contracts it's made of: the token itself and its subnets */
    tokens: string[];
}

/** Adds each token's Stacks and Blaze sides together, keyed by the base token (".stx" for STX) */
export function combineSubnets(sheet: BalanceSheet): Record<string, CombinedBalance> {
    const combined: Record<string, CombinedBalance> = {};
    for (const [token, part] of Object.entries(sheet.tokens)) {
        const key = part.base ?? token;
        const into = combined[key] ?? (combined[key] = { settled: '0', pending: '0', held: '0', ready: '0', tokens: [] });
        const add = (a: string | null, b: string | null) => (a === null || b === null ? null : (BigInt(a) + BigInt(b)).toString());
        into.settled = add(into.settled, part.settled);
        into.ready = add(into.ready, part.ready);
        into.pending = (BigInt(into.pending) + BigInt(part.pending)).toString();
        into.held = (BigInt(into.held) + BigInt(part.held)).toString();
        into.tokens.push(token);
    }
    return combined;
}
