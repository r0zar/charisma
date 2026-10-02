import { REVEAL_MS } from '@/lib/roulette/wheel';
import type { PublicBet, PublicRound, RoundPayload } from '@/lib/roulette/types';
import type { Slice } from '@/lib/roulette/types';

export type Screen =
    | { kind: 'loading' }
    | { kind: 'starting' }
    | { kind: 'open' | 'locked' | 'drawing'; round: PublicRound }
    | { kind: 'reveal'; round: PublicRound; next: PublicRound | null }
    | { kind: 'result'; round: PublicRound; next: PublicRound | null };

/** What to show, from the payload and the server clock alone: the same answer on every device. */
export function screenAt(p: RoundPayload | null, now: number): Screen {
    if (!p) return { kind: 'loading' };
    const { round, last } = p;
    if (last?.draw && now < last.draw.drawnAt + REVEAL_MS) {
        return last.draw.winner ? { kind: 'reveal', round: last, next: round } : { kind: 'result', round: last, next: round };
    }
    if (last && round?.status === 'live' && now < round.opensAt) return { kind: 'result', round: last, next: round };
    if (!round || round.status !== 'live') return { kind: 'starting' };
    if (now < round.locksAt) return { kind: 'open', round };
    if (now < round.endsAt) return { kind: 'locked', round };
    return { kind: 'drawing', round };
}

export const slicesOf = (round: PublicRound): Slice[] => Object.entries(round.tally).map(([tokenId, stake]) => ({ tokenId, stake }));

export const potOf = (round: PublicRound) => Object.values(round.tally).reduce((sum, s) => sum + BigInt(s), 0n);

/** The viewer's bets in a given round: rounds don't overlap, so placedAt says which round a bet belongs to. */
export const betsIn = (round: PublicRound, bets: PublicBet[] = []) =>
    bets.filter(b => b.placedAt >= round.opensAt && b.placedAt < round.endsAt);
