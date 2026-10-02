/**
 * The only code that writes round state. Safe to call from anywhere, any number of times, at once:
 * it takes a lock, does whatever is due, and every write compares the round's version. See DESIGN.md.
 */
import { drawWinner, fundedBets, newSeed, slicesOf } from './draw';
import type { Chain } from './chain';
import type { Hooks } from './hooks';
import type { Store } from './store';
import type { Bet, Round, RouletteConfig } from './types';

export interface EngineDeps {
    store: Store;
    chain: Chain;
    hooks: Hooks;
    now: () => number;
    /** the old game's scheduled spin, so the first v2 round keeps the live schedule */
    legacyEndsAt?: () => Promise<number | null>;
    log?: (message: string) => void;
}

export interface AdvanceReport {
    ran: boolean;
    created?: string;
    drawn?: { round: string; winner: string | null };
    broadcast: number;
    confirmed: number;
    failed: number;
    settled: string[];
}

const MAX_ATTEMPTS = 3;
/** a sent swap that Hiro still doesn't know after this long was dropped from the mempool */
const DROPPED_AFTER_MS = 60 * 60 * 1000;

/** The engine runs only where production turns it on, so a local server can never draw or broadcast. */
export const engineEnabled = () => process.env.ROULETTE_ENGINE === 'on';

const roundNumber = (id: string) => Number(id.replace('round_', ''));

export async function createRound(deps: EngineDeps, n: number, opensAt: number, config: RouletteConfig, endsAt = opensAt + config.roundMs): Promise<Round> {
    const { seed, seedHash } = newSeed();
    const round: Round = {
        id: `round_${n}`,
        status: 'live',
        opensAt,
        locksAt: endsAt - config.lockMs,
        endsAt,
        seedHash,
        seed,
        version: 1,
    };
    if (!(await deps.store.saveRound(round))) throw new Error(`Round ${round.id} already exists`);
    await deps.store.setCurrentId(round.id);
    await safely(deps, `roundCreated ${round.id}`, () => deps.hooks.roundCreated(round));
    return round;
}

/** The leaderboard and history must never stop the game: their failures are logged, not thrown. */
async function safely(deps: EngineDeps, what: string, fn: () => Promise<unknown>) {
    try { await fn(); } catch (e) { deps.log?.(`hook ${what} failed: ${e instanceof Error ? e.message : String(e)}`); }
}

async function save(deps: EngineDeps, round: Round): Promise<Round | null> {
    const next = { ...round, version: round.version + 1 };
    return (await deps.store.saveRound(next)) ? next : null;
}

export async function advanceRound(deps: EngineDeps, budgetMs: number): Promise<AdvanceReport> {
    const report: AdvanceReport = { ran: false, broadcast: 0, confirmed: 0, failed: 0, settled: [] };
    const deadline = deps.now() + budgetMs;
    const token = await deps.store.lock(budgetMs + 60_000);
    if (!token) return report;
    report.ran = true;
    try {
        const config = await deps.store.getConfig();
        const currentId = await deps.store.getCurrentId();
        let round = currentId ? await deps.store.getRound(currentId) : null;
        if (!round) {
            const legacy = await deps.legacyEndsAt?.();
            const now = deps.now();
            round = await createRound(deps, 1, now, config, legacy && legacy > now + config.lockMs ? legacy : undefined);
            report.created = round.id;
        }
        if (round.status !== 'live') {
            // a crash between drawing a round and opening the next one: finish the hand-off
            await deps.store.addHistory(round.id, round.endsAt);
            const nextId = `round_${roundNumber(round.id) + 1}`;
            const existing = await deps.store.getRound(nextId);
            if (existing) await deps.store.setCurrentId(nextId);
            round = existing ?? await createRound(deps, roundNumber(round.id) + 1, Math.max(deps.now(), (round.draw?.drawnAt ?? 0) + config.intermissionMs), config);
            report.created = round.id;
        }
        if (round.status === 'live' && deps.now() >= round.endsAt) {
            const drawn = await drawRound(deps, round, config);
            if (drawn) {
                report.drawn = { round: drawn.round.id, winner: drawn.round.draw!.winner };
                report.created = drawn.next.id;
            }
        }
        await settleRounds(deps, deadline, report);
    } finally {
        await deps.store.unlock(token);
    }
    return report;
}

async function drawRound(deps: EngineDeps, round: Round, config: RouletteConfig): Promise<{ round: Round; next: Round } | null> {
    const block = await deps.chain.firstBlockAtOrAfter(round.endsAt);
    if (!block) return null; // not mined yet: the next call draws

    const placed = (await deps.store.getBets(round.id)).filter(b => b.status === 'placed');
    const users = [...new Set(placed.map(b => b.user))];
    const balances = new Map(await Promise.all(users.map(async u => [u, await deps.chain.balance(u)] as const)));
    const { valid, excluded } = fundedBets(placed, balances);
    for (const b of excluded) await deps.store.putBet(round.id, { ...b, status: 'excluded', error: 'Not enough subnet CHA at the draw' });

    const slices = slicesOf(valid);
    const result = drawWinner(round.seed, block.hash, slices);
    const drawnAt = deps.now();
    const drawn = await save(deps, {
        ...round,
        status: result.winner ? 'drawn' : 'settled',
        ...(result.winner ? {} : { settledAt: drawnAt }),
        draw: { block, ticket: result.ticket, total: result.total, slices, winner: result.winner, drawnAt, turns: result.turns },
    });
    if (!drawn) return null; // someone else drew it

    await deps.store.addHistory(drawn.id, drawn.endsAt);
    const stats = await deps.store.getStats();
    const isATH = BigInt(result.total) > BigInt(stats.athTotal);
    await deps.store.setStats({ athTotal: isATH ? result.total : stats.athTotal, previousTotal: result.total });

    const next = await createRound(deps, roundNumber(round.id) + 1, drawnAt + config.intermissionMs, config);
    await safely(deps, `roundDrawn ${drawn.id}`, () => deps.hooks.roundDrawn(drawn, valid, isATH));
    deps.log?.(`drew ${drawn.id}: ${result.winner ?? 'no stake'} (ticket ${result.ticket}/${result.total}, block ${block.height})`);
    return { round: drawn, next };
}

/**
 * Confirm what's in flight, then broadcast the rest, oldest bets first, until the deadline.
 * There is no price protection on purpose: the group buy pumps the winner and everyone gets what the pump gives them.
 */
async function settleRounds(deps: EngineDeps, deadline: number, report: AdvanceReport) {
    for (const id of await deps.store.history(10)) {
        let round = await deps.store.getRound(id);
        if (round?.status !== 'drawn' || !round.draw?.winner) continue;
        const winner = round.draw.winner;

        for (const bet of (await deps.store.getBets(id)).filter(b => b.status === 'sent')) {
            if (deps.now() >= deadline) return;
            await confirm(deps, round, bet, report);
        }
        const toSend = (await deps.store.getBets(id))
            .filter(b => b.status === 'placed' || b.status === 'sending')
            .sort((a, b) => a.placedAt - b.placedAt || (a.uuid < b.uuid ? -1 : 1));
        for (const bet of toSend) {
            if (deps.now() >= deadline) return;
            await broadcast(deps, round, bet, winner, report);
        }

        const after = await deps.store.getBets(id);
        if (after.every(b => b.status === 'confirmed' || b.status === 'failed' || b.status === 'excluded')) {
            round = await save(deps, { ...round, status: 'settled', settledAt: deps.now() });
            if (round) report.settled.push(id);
        }
    }
}

/** true when the swap is now in flight */
async function broadcast(deps: EngineDeps, round: Round, bet: Bet, winner: string, report: AdvanceReport): Promise<boolean> {
    // a bet tried before may already have landed (a crash mid-broadcast, a mempool we gave up on): then its uuid is
    // spent on-chain and sending it again could only fail
    if ((bet.attempts ?? 0) > 0 && await deps.chain.uuidSpent(bet.uuid)) {
        await deps.store.putBet(round.id, { ...bet, status: 'confirmed', error: 'Landed on an earlier attempt; its transaction id was not recorded' });
        report.confirmed++;
        return false;
    }
    const attempts = (bet.attempts ?? 0) + 1;
    await deps.store.putBet(round.id, { ...bet, status: 'sending', attempts });
    try {
        const { txid } = await deps.chain.swap(bet, winner);
        await deps.store.putBet(round.id, { ...bet, status: 'sent', attempts, txid, sentAt: deps.now(), error: undefined });
        report.broadcast++;
        return true;
    } catch (e) {
        await retryOrFail(deps, round, { ...bet, attempts }, e instanceof Error ? e.message : String(e), report);
        return false;
    }
}

async function confirm(deps: EngineDeps, round: Round, bet: Bet, report: AdvanceReport) {
    const outcome = await deps.chain.txOutcome(bet.txid!);
    if (outcome.status === 'success') {
        const done = { ...bet, status: 'confirmed' as const, amountOut: outcome.amountOut, error: undefined };
        await deps.store.putBet(round.id, done);
        report.confirmed++;
        await safely(deps, `betConfirmed ${bet.uuid}`, () => deps.hooks.betConfirmed(round, done));
    } else if (outcome.status === 'failed') {
        // an aborted swap rolls back, so its uuid is still unspent and it can go again at the new price
        await retryOrFail(deps, round, bet, outcome.reason ?? 'The swap failed on-chain', report);
    } else if (bet.sentAt && deps.now() - bet.sentAt > DROPPED_AFTER_MS) {
        await retryOrFail(deps, round, bet, 'Dropped from the mempool', report);
    }
}

async function retryOrFail(deps: EngineDeps, round: Round, bet: Bet, error: string, report: AdvanceReport) {
    const failed = (bet.attempts ?? 0) >= MAX_ATTEMPTS;
    await deps.store.putBet(round.id, { ...bet, status: failed ? 'failed' : 'placed', error });
    if (failed) report.failed++;
    deps.log?.(`swap ${bet.uuid} attempt ${bet.attempts ?? 0} failed${failed ? ' for good' : ', will retry'}: ${error}`);
}

/** Admin: end the live round without a draw. Its bets never execute; the next round opens now. */
export async function voidRound(deps: EngineDeps): Promise<Round> {
    return withLock(deps, async () => {
        const round = await liveRound(deps);
        const voided = await save(deps, { ...round, status: 'void', settledAt: deps.now() });
        if (!voided) throw new Error('The round changed while voiding it; try again');
        return createRound(deps, roundNumber(round.id) + 1, deps.now(), await deps.store.getConfig());
    });
}

/** Admin: move the live round's draw time. */
export async function rescheduleRound(deps: EngineDeps, endsAt: number): Promise<Round> {
    return withLock(deps, async () => {
        const round = await liveRound(deps);
        const config = await deps.store.getConfig();
        if (endsAt - config.lockMs <= deps.now()) throw new Error('The new draw time must leave the lock window in the future');
        const moved = await save(deps, { ...round, endsAt, locksAt: endsAt - config.lockMs });
        if (!moved) throw new Error('The round changed while rescheduling it; try again');
        return moved;
    });
}

async function liveRound(deps: EngineDeps): Promise<Round> {
    const id = await deps.store.getCurrentId();
    const round = id ? await deps.store.getRound(id) : null;
    if (!round || round.status !== 'live') throw new Error('There is no live round');
    return round;
}

async function withLock<T>(deps: EngineDeps, fn: () => Promise<T>): Promise<T> {
    const token = await deps.store.lock(60_000);
    if (!token) throw new Error('The engine is busy; try again in a moment');
    try { return await fn(); } finally { await deps.store.unlock(token); }
}
