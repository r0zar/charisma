import type { BalanceEntry, BalanceSheet } from 'blaze-sdk';

/** How one shown balance is made, added up across the contracts behind it (a token's Standard side, or its Blaze subnets) */
export interface Rollup {
    /** On the chain; null when any part couldn't be read */
    settled: bigint | null;
    pending: bigint;
    /** Promised to signed orders and bets (zero or negative); still the owner's, so it isn't taken out of `ready` */
    held: bigint;
    /** On the chain plus on its way */
    ready: bigint | null;
    /** How much more the signed orders count on than the balance holds (0 when it covers them) */
    over: bigint;
    entries: BalanceEntry[];
    /** Some of it is a swap's likely amount, not yet a fixed one */
    estimated: boolean;
}

export function rollup(sheet: BalanceSheet, tokens: string[]): Rollup {
    const parts = tokens.map(token => sheet.tokens[token]).filter(part => part !== undefined);
    const unread = parts.some(part => part.settled === null);
    const settled = parts.reduce((sum, part) => sum + BigInt(part.settled ?? '0'), 0n);
    const pending = parts.reduce((sum, part) => sum + BigInt(part.pending), 0n);
    const held = parts.reduce((sum, part) => sum + BigInt(part.held), 0n);
    const entries = parts.flatMap(part => part.entries).sort((a, b) => b.at - a.at);
    return {
        settled: unread ? null : settled,
        pending,
        held,
        ready: unread ? null : settled + pending,
        over: unread || settled + pending + held >= 0n ? 0n : -(settled + pending + held),
        entries,
        estimated: entries.some(e => e.kind === 'swap' && e.amount.startsWith('-') === false && e.stage === 'pending'),
    };
}
