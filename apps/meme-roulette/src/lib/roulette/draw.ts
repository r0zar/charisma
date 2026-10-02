/** The provably fair draw: a committed seed mixed with a Stacks block hash nobody knew while bets were open. */
import { createHash, randomBytes } from 'node:crypto';
import type { Bet, Slice } from './types';

const strip0x = (hex: string) => hex.replace(/^0x/, '');

export function newSeed(): { seed: string; seedHash: string } {
    const seed = randomBytes(32).toString('hex');
    return { seed, seedHash: sha256Hex(seed) };
}

export const sha256Hex = (hex: string) => createHash('sha256').update(Buffer.from(strip0x(hex), 'hex')).digest('hex');

/** Valid stake per token, sorted by tokenId. */
export function slicesOf(bets: Bet[]): Slice[] {
    const byToken = new Map<string, bigint>();
    for (const b of bets) byToken.set(b.tokenId, (byToken.get(b.tokenId) ?? 0n) + BigInt(b.amount));
    return [...byToken.entries()]
        .filter(([, stake]) => stake > 0n)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([tokenId, stake]) => ({ tokenId, stake: stake.toString() }));
}

export interface DrawResult {
    ticket: string;
    total: string;
    winner: string | null;
    turns: number;
}

/**
 * ticket = sha256(seed ‖ blockHash) mod total; the winner is the slice whose stake range holds the ticket.
 * Anyone can recompute this from a drawn round's public record.
 */
export function drawWinner(seed: string, blockHash: string, slices: Slice[]): DrawResult {
    const total = slices.reduce((sum, s) => sum + BigInt(s.stake), 0n);
    const h = BigInt('0x' + sha256Hex(strip0x(seed) + strip0x(blockHash)));
    const turns = 6 + Number(h % 4n);
    if (total === 0n) return { ticket: '0', total: '0', winner: null, turns };
    const ticket = h % total;
    let running = 0n;
    for (const s of slices) {
        running += BigInt(s.stake);
        if (ticket < running) return { ticket: ticket.toString(), total: total.toString(), winner: s.tokenId, turns };
    }
    throw new Error('drawWinner: ticket fell outside the slices');
}

/**
 * Freeze the bets that count: per user, oldest first, while their running total fits their subnet balance.
 * Returns the bets to keep and the ones to exclude.
 */
export function fundedBets(bets: Bet[], balances: Map<string, bigint>): { valid: Bet[]; excluded: Bet[] } {
    const valid: Bet[] = [], excluded: Bet[] = [];
    const spent = new Map<string, bigint>();
    for (const b of [...bets].sort((x, y) => x.placedAt - y.placedAt || (x.uuid < y.uuid ? -1 : 1))) {
        const used = spent.get(b.user) ?? 0n;
        const next = used + BigInt(b.amount);
        if (next <= (balances.get(b.user) ?? 0n)) { valid.push(b); spent.set(b.user, next); }
        else excluded.push(b);
    }
    return { valid, excluded };
}
