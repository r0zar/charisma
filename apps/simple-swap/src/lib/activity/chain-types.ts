/** What a mined transaction did for one wallet, in a word */
export type ChainActivityKind = 'to-blaze' | 'to-standard' | 'swap' | 'order' | 'send' | 'receive' | 'other';

/** One mined transaction, as it changed one wallet's balances */
export interface ChainActivity {
    txid: string;
    /** Its block's time, unix ms */
    at: number;
    status: 'success' | 'failed';
    kind: ChainActivityKind;
    /** What moved, per contract (a Blaze subnet is its own contract; ".stx" is STX), signed smallest units */
    flows: { token: string; amount: string }[];
    /** STX fee in micro-STX, when this wallet paid it */
    fee?: string;
    /** The other wallet in a send or receive */
    counterparty?: string;
    /** The contract and function it called, e.g. "SP….stx-subnet-v2 deposit" */
    call?: string;
    /** The Charisma order that ran in it, e.g. "DCA buy 1 of 24" */
    order?: string;
}

export interface ChainActivityPage {
    items: ChainActivity[];
    /** The offset of the next page; null on the last one */
    next: number | null;
}
