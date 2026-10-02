/** What the engine tells the leaderboard, achievements and round history. */
import { kv } from '@vercel/kv';
import { listTokens } from 'dexterity-sdk';
import {
    initializeRound,
    updateUserStatsAfterVote,
    recordRoundActivity,
    checkAndAwardAchievements,
    updateUserStatsAfterRound,
    type RoundMetadata,
} from '@/lib/leaderboard-kv';
import { updateUserStatsWithRealEarnings } from '@/lib/leaderboard-integration';
import { calculateEarningsUSD } from '@/lib/token-prices';
import type { Bet, Round } from './types';

export interface Hooks {
    roundCreated(round: Round): Promise<void>;
    betPlaced(round: Round, bet: Bet): Promise<unknown[]>;
    roundDrawn(round: Round, valid: Bet[], isATH: boolean): Promise<void>;
    betConfirmed(round: Round, bet: Bet): Promise<void>;
}

export const noHooks: Hooks = {
    roundCreated: async () => {},
    betPlaced: async () => [],
    roundDrawn: async () => {},
    betConfirmed: async () => {},
};

export const leaderboardHooks: Hooks = {
    async roundCreated(round) {
        await initializeRound(round.id, round.opensAt, round.endsAt);
    },

    async betPlaced(round, bet) {
        const amount = Number(bet.amount);
        await Promise.all([
            updateUserStatsAfterVote(bet.user, amount, round.id),
            recordRoundActivity(bet.user, round.id, bet.tokenId, amount),
        ]);
        return checkAndAwardAchievements(bet.user);
    },

    async roundDrawn(round, valid, isATH) {
        const draw = round.draw!;
        const players = [...new Set(valid.map(b => b.user))];
        const tokenBets = Object.fromEntries(draw.slices.map(s => [s.tokenId, Number(s.stake)]));
        const meta: RoundMetadata = {
            roundId: round.id,
            startTime: round.opensAt,
            endTime: round.endsAt,
            winningTokenId: draw.winner,
            totalCHACommitted: Number(draw.total),
            totalParticipants: players.length,
            totalVotes: valid.length,
            isATH,
        };
        const topTokens = Object.entries(tokenBets).sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([token, amount]) => ({ token, amount }));
        await kv.multi()
            .set(`round:${round.id}:meta`, { ...meta, topTokens })
            .set(`round:${round.id}:totals`, { totalCHACommitted: meta.totalCHACommitted, totalParticipants: players.length, totalVotes: valid.length, tokenBets })
            .zadd('historic:rounds', { score: round.endsAt, member: round.id })
            .del('leaderboard:current_round')
            .exec();
        for (const user of players) {
            await updateUserStatsAfterRound(user, round.id, valid.some(b => b.user === user && b.tokenId === draw.winner), 0);
        }
    },

    async betConfirmed(round, bet) {
        const winner = round.draw?.winner;
        if (!winner || !bet.amountOut) return;
        const token = (await listTokens()).find(t => t.contractId === winner);
        const { earningsCHA } = await calculateEarningsUSD(Number(bet.amount), Number(bet.amountOut), winner, 6, token?.decimals ?? 6);
        await updateUserStatsWithRealEarnings(bet.user, earningsCHA * 1e6);
    },
};
