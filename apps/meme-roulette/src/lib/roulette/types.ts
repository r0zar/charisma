/** Meme Roulette v2: one round record, written only by the engine. See DESIGN.md. */

export type RoundStatus = 'live' | 'drawn' | 'settled' | 'void';

export interface Slice {
    tokenId: string;
    /** valid stake, micro-CHA */
    stake: string;
}

export interface Draw {
    /** the first Stacks block mined at or after the round's endsAt */
    block: { height: number; hash: string; time: number };
    /** sha256(seed ‖ block hash) mod total */
    ticket: string;
    /** total valid stake, micro-CHA */
    total: string;
    /** frozen at the draw, sorted by tokenId */
    slices: Slice[];
    /** null when nobody played */
    winner: string | null;
    /** ms on the server clock: the reveal starts here */
    drawnAt: number;
    /** whole turns the wheel makes before landing, from the seed (6 to 9) */
    turns: number;
}

export interface Round {
    id: string;
    status: RoundStatus;
    opensAt: number;
    locksAt: number;
    endsAt: number;
    seedHash: string;
    /** server-only until the draw */
    seed: string;
    draw?: Draw;
    settledAt?: number;
    version: number;
}

export type BetStatus = 'placed' | 'excluded' | 'sending' | 'sent' | 'confirmed' | 'failed';

export interface Bet {
    uuid: string;
    user: string;
    tokenId: string;
    /** the CHA subnet the bet spends; absent on bets placed before Blaze v2, which all spent v1 */
    subnet?: string;
    /** micro-CHA */
    amount: string;
    signature: string;
    router: string;
    placedAt: number;
    status: BetStatus;
    txid?: string;
    sentAt?: number;
    /** winning-token base units received */
    amountOut?: string;
    error?: string;
    attempts?: number;
}

export interface RouletteConfig {
    roundMs: number;
    lockMs: number;
    intermissionMs: number;
}

export interface RouletteStats {
    athTotal: string;
    previousTotal: string;
}

/** What the public sees of a round: no seed before the draw. */
export type PublicRound = Omit<Round, 'seed' | 'version'> & {
    seed?: string;
    /** live tally per token (micro-CHA) while betting; the frozen slices after the draw */
    tally: Record<string, string>;
    players: number;
    bets: number;
};

/** What the public sees of a bet: no signature. */
export type PublicBet = Omit<Bet, 'signature'>;

export interface RoundPayload {
    serverNow: number;
    config: RouletteConfig;
    stats: RouletteStats;
    round: PublicRound | null;
    last: PublicRound | null;
    recentBets: PublicBet[];
    /** the requested user's bets in `round` and `last` */
    myBets?: PublicBet[];
}
