/** What leaves the server: no signatures ever, and no seed until the round is drawn. */
import type { Store } from './store';
import type { Bet, PublicBet, PublicRound, Round, RoundPayload } from './types';

export const toPublicBet = ({ signature: _signature, ...bet }: Bet): PublicBet => bet;

export function toPublicRound({ seed, version: _version, ...round }: Round, bets: Bet[]): PublicRound {
    const counted = bets.filter(b => b.status !== 'excluded');
    const tally: Record<string, string> = {};
    if (round.draw) for (const s of round.draw.slices) tally[s.tokenId] = s.stake;
    else for (const b of counted) tally[b.tokenId] = (BigInt(tally[b.tokenId] ?? '0') + BigInt(b.amount)).toString();
    return {
        ...round,
        ...(round.draw ? { seed } : {}),
        tally,
        players: new Set(counted.map(b => b.user)).size,
        bets: counted.length,
    };
}

export async function roundPayload(store: Store, now: number, user?: string): Promise<RoundPayload> {
    const [config, stats, currentId, [lastId]] = await Promise.all([
        store.getConfig(), store.getStats(), store.getCurrentId(), store.history(1),
    ]);
    const [round, last] = await Promise.all([currentId, lastId].map(id => (id ? store.getRound(id) : null)));
    const [roundBets, lastBets] = await Promise.all([round, last].map(r => (r ? store.getBets(r.id) : [])));
    const newestFirst = (a: Bet, b: Bet) => b.placedAt - a.placedAt;
    return {
        serverNow: now,
        config,
        stats,
        round: round ? toPublicRound(round, roundBets) : null,
        last: last ? toPublicRound(last, lastBets) : null,
        recentBets: [...roundBets].sort(newestFirst).slice(0, 12).map(toPublicBet),
        ...(user ? { myBets: [...roundBets, ...lastBets].filter(b => b.user === user).sort(newestFirst).map(toPublicBet) } : {}),
    };
}
