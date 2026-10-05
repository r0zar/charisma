/**
 * Instant balances: what an address holds on the chain, plus every change the chain hasn't settled yet, so a balance
 * moves the moment someone approves. Each token is one contract: STX (".stx"), a SIP-10 token, or a Blaze subnet. A
 * wallet adds a token's Stacks and Blaze sides together itself, the same way it does with settled balances.
 */

/** Sent and waiting for a block (pending), or promised to a signed order or bet that hasn't run (hold) */
export type EntryStage = 'pending' | 'hold';

export type EntryKind = 'transfer' | 'swap' | 'deposit' | 'withdraw' | 'fee' | 'order' | 'bet';

/** One unsettled change to one token's balance */
export interface BalanceEntry {
    /** Stable across reads: `${txid}:${token}`, `order:${handle}` or `bet:${round}:${index}` */
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
    /** Hiro's status, e.g. abort_by_post_condition or dropped_replace_by_fee */
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
