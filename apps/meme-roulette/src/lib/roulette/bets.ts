/** Accepting a bet: a signed, funded intent for a listed meme while the round is open, stored once per uuid. */
import type { Chain } from './chain';
import type { Hooks } from './hooks';
import type { Store } from './store';
import type { Bet, PublicBet } from './types';
import { toPublicBet } from './public';

export interface BetInput {
    signature: string;
    uuid: string;
    /** who claims to have signed; checked against the signature, never trusted */
    user: string;
    tokenId: string;
    /** micro-CHA */
    amount: string;
}

export interface BetDeps {
    store: Store;
    chain: Pick<Chain, 'balance'>;
    hooks: Pick<Hooks, 'betPlaced'>;
    now: () => number;
    /** the router the intent was signed for; throws when `user` didn't sign it */
    signedRouter: (input: BetInput) => Promise<string>;
    /** whether the meme can be backed */
    isPlayable: (tokenId: string) => Promise<boolean>;
}

export class BetError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
}

/** 1 CHA */
export const MIN_BET = 1_000_000n;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function placeBet(deps: BetDeps, input: BetInput): Promise<{ bet: PublicBet; repeated: boolean; achievements: unknown[] }> {
    if (!UUID.test(input.uuid)) throw new BetError('The bet needs a uuid', 400);
    if (!/^\d+$/.test(input.amount) || BigInt(input.amount) < MIN_BET) throw new BetError('The smallest bet is 1 CHA', 400);

    const roundId = await deps.store.getCurrentId();
    const round = roundId ? await deps.store.getRound(roundId) : null;
    if (!round) throw new BetError('No round is running', 409);

    const existing = await deps.store.getBet(round.id, input.uuid);
    if (existing) {
        if (existing.signature !== input.signature) throw new BetError('That uuid is already used by another bet', 409);
        return { bet: toPublicBet(existing), repeated: true, achievements: [] };
    }

    const now = deps.now();
    if (round.status !== 'live' || now < round.opensAt) throw new BetError('The next round has not opened yet', 409);
    if (now >= round.locksAt) throw new BetError('Betting is locked for this round', 409);
    if (!(await deps.isPlayable(input.tokenId))) throw new BetError('That meme is not in the game', 400);

    let router: string;
    try {
        router = await deps.signedRouter(input);
    } catch {
        throw new BetError('The signature does not match this bet', 401);
    }

    const mine = (await deps.store.getBets(round.id)).filter(b => b.user === input.user && b.status !== 'excluded');
    const committed = mine.reduce((sum, b) => sum + BigInt(b.amount), 0n) + BigInt(input.amount);
    const balance = await deps.chain.balance(input.user);
    if (balance < committed) {
        throw new BetError(`Your subnet balance covers ${balance / 1_000_000n} CHA, and this round's bets would need ${committed / 1_000_000n} CHA`, 402);
    }

    const bet: Bet = {
        uuid: input.uuid,
        user: input.user,
        tokenId: input.tokenId,
        amount: input.amount,
        signature: input.signature,
        router,
        placedAt: now,
        status: 'placed',
    };
    if (!(await deps.store.addBet(round.id, bet))) {
        // the same request raced itself: answer like a repeat
        const raced = await deps.store.getBet(round.id, input.uuid);
        if (raced?.signature === input.signature) return { bet: toPublicBet(raced), repeated: true, achievements: [] };
        throw new BetError('That uuid is already used by another bet', 409);
    }
    // the bet is stored: a leaderboard hiccup must not tell the player it failed
    const achievements = await deps.hooks.betPlaced(round, bet).catch(e => {
        console.error(`leaderboard update for bet ${bet.uuid} failed:`, e);
        return [];
    });
    return { bet: toPublicBet(bet), repeated: false, achievements };
}
