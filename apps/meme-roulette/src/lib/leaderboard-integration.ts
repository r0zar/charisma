import {
    updateUserStatsAfterVote,
    recordRoundActivity,
    updateUserStatsAfterRound,
    checkAndAwardAchievements,
    initializeRound,
    getCurrentRoundId,
    getUserStats,
    getLeaderboard,
    initializeLeaderboardSystem,
    type LeaderboardEntry,
    type UserStats
} from './leaderboard-kv';
import {
    recordUserVote,
    incrementKVTokenBet,
    resetKVForNextSpin,
    setKVSpinScheduledAt,
    setKVWinningToken,
    getKVSpinStatus
} from './state';
import type { Vote } from '@/types/spin';
import { v4 as uuidv4 } from 'uuid';
import { kv } from '@vercel/kv';

// ========================================
// KEY PATTERNS (duplicated from leaderboard-kv for access)
// ========================================

const ROUND_PARTICIPANTS_KEY = (roundId: string) => `round:${roundId}:participants`;
const LEADERBOARD_CURRENT_ROUND = 'leaderboard:current_round';
const LEADERBOARD_EARNINGS = 'leaderboard:earnings';
const USER_STATS_KEY = (userId: string) => `user:${userId}:stats`;
const ROUND_META_KEY = (roundId: string) => `round:${roundId}:meta`;

// ========================================
// INTEGRATION FUNCTIONS
// ========================================

/**
 * Enhanced vote recording that updates both voting state and leaderboard
 */
export async function recordVoteWithLeaderboard(
    userId: string,
    tokenId: string,
    amount: number
): Promise<{ vote: Vote | null; achievements: any[] }> {
    try {
        // Get current round ID or generate one if none exists
        let currentRoundId = await getCurrentRoundId();
        if (!currentRoundId) {
            const spinStatus = await getKVSpinStatus();
            currentRoundId = `round_${Date.now()}`;

            // Initialize round with spin timing
            const roundDuration = spinStatus.roundDuration;
            const startTime = spinStatus.spinScheduledAt - roundDuration;
            const endTime = spinStatus.spinScheduledAt;

            await initializeRound(currentRoundId, startTime, endTime);
        }

        // Record vote in existing system
        const vote = await recordUserVote(userId, tokenId, amount);
        if (!vote) {
            return { vote: null, achievements: [] };
        }

        // Update token bets
        await incrementKVTokenBet(tokenId, amount);

        // Update leaderboard data
        await Promise.all([
            updateUserStatsAfterVote(userId, amount, currentRoundId),
            recordRoundActivity(userId, currentRoundId, tokenId, amount)
        ]);

        // Check for new achievements
        const newAchievements = await checkAndAwardAchievements(userId);

        console.log(`Vote recorded with leaderboard update: ${userId} -> ${tokenId} (${amount} CHA)`);

        return { vote, achievements: newAchievements };
    } catch (error) {
        console.error('Failed to record vote with leaderboard:', error);
        throw error;
    }
}

/**
 * Enhanced round completion that updates leaderboard stats
 */
export async function completeRoundWithLeaderboard(
    winningTokenId: string,
    winnerRewards?: Record<string, number>
): Promise<void> {
    try {
        const currentRoundId = await getCurrentRoundId();
        if (!currentRoundId) {
            console.warn('No current round ID found for completion');
            return;
        }

        // Set winning token in existing system
        await setKVWinningToken(winningTokenId);

        // --- Update round metadata with winner ---
        const roundMetaKey = `round:${currentRoundId}:meta`;
        const roundMetaObj = await kv.get(roundMetaKey);
        if (roundMetaObj) {
            (roundMetaObj as any).winningTokenId = winningTokenId;
            await kv.set(roundMetaKey, roundMetaObj);
        }

        // Process all participants for round completion stats
        if (winnerRewards) {
            const updatePromises = Object.entries(winnerRewards).map(([userId, earnings]) =>
                updateUserStatsAfterRound(userId, currentRoundId, true, earnings)
            );

            await Promise.all(updatePromises);
        }

        // Process non-winners (users who participated but didn't win)
        const allParticipants = await kv.smembers(ROUND_PARTICIPANTS_KEY(currentRoundId));
        const winnerUserIds = new Set(Object.keys(winnerRewards || {}));

        const nonWinnerPromises = allParticipants
            .filter(userId => !winnerUserIds.has(userId))
            .map(userId => updateUserStatsAfterRound(userId, currentRoundId, false, 0));

        await Promise.all(nonWinnerPromises);

        // --- Add round to historic:rounds sorted set ---
        // Fetch round metadata to get endTime
        const roundMeta = await kv.get(ROUND_META_KEY(currentRoundId));
        if (roundMeta && (roundMeta as any).endTime) {
            await kv.zadd('historic:rounds', { score: (roundMeta as any).endTime, member: currentRoundId });
        }

        // Reset current round leaderboard for next round
        await kv.del(LEADERBOARD_CURRENT_ROUND);

        console.log(`Round ${currentRoundId} completed with leaderboard updates`);
    } catch (error) {
        console.error('Failed to complete round with leaderboard:', error);
        throw error;
    }
}

/**
 * Get comprehensive user profile including stats and achievements
 */
export async function getUserProfile(userId: string): Promise<{
    stats: UserStats;
    totalCHARank: number | null;
    totalVotesRank: number | null;
    currentRoundRank: number | null;
}> {
    try {
        const [stats, totalCHARank, totalVotesRank, currentRoundRank] = await Promise.all([
            getUserStats(userId),
            getUserRank(userId, 'total_cha'),
            getUserRank(userId, 'total_votes'),
            getUserRank(userId, 'current_round')
        ]);

        return {
            stats,
            totalCHARank,
            totalVotesRank,
            currentRoundRank
        };
    } catch (error) {
        console.error(`Failed to get user profile for ${userId}:`, error);
        throw error;
    }
}

/**
 * Get comprehensive leaderboard data for frontend
 */
export async function getComprehensiveLeaderboard(
    type: 'total_cha' | 'total_votes' | 'current_round' = 'total_cha',
    limit: number = 50
): Promise<{
    entries: LeaderboardEntry[];
    totalUsers: number;
    lastUpdated: number;
}> {
    try {
        const entries = await getLeaderboard(type, limit);

        // Get total user count from leaderboard size
        const totalUsers = entries.length > 0 ? await getUserCount() : 0;

        return {
            entries,
            totalUsers,
            lastUpdated: Date.now()
        };
    } catch (error) {
        console.error(`Failed to get comprehensive leaderboard:`, error);
        return {
            entries: [],
            totalUsers: 0,
            lastUpdated: Date.now()
        };
    }
}

/**
 * Initialize the entire integrated system
 */
export async function initializeIntegratedSystem(): Promise<void> {
    try {
        // Initialize leaderboard system
        await initializeLeaderboardSystem();

        console.log('Integrated leaderboard system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize integrated system:', error);
        throw error;
    }
}

/**
 * Update user statistics with real earnings from completed swaps
 */
export async function updateUserStatsWithRealEarnings(
    userId: string,
    realEarnings: number
): Promise<void> {
    try {
        const stats = await getUserStats(userId);

        // Update earnings with real calculated amount
        stats.totalEarnings = realEarnings;
        stats.updatedAt = Date.now();

        // If user made a profit, increment win count
        if (realEarnings > 0) {
            stats.winCount += 1;
        }

        // Save updated stats
        await kv.set(USER_STATS_KEY(userId), stats);

        // Update earnings leaderboard
        if (realEarnings > 0) {
            await kv.zadd(LEADERBOARD_EARNINGS, { score: realEarnings, member: userId });
        }

        console.log(`Updated real earnings for ${userId}: ${realEarnings.toFixed(4)} CHA equivalent`);
    } catch (error) {
        console.error(`Failed to update real earnings for user ${userId}:`, error);
    }
}

// ========================================
// HELPER FUNCTIONS  
// ========================================

/**
 * Get user rank from leaderboard (helper function)
 */
async function getUserRank(
    userId: string,
    type: 'total_cha' | 'total_votes' | 'current_round'
): Promise<number | null> {
    try {
        // Import the function from leaderboard-kv
        const { getUserRank } = await import('./leaderboard-kv');
        return await getUserRank(userId, type);
    } catch (error) {
        console.error(`Failed to get user rank:`, error);
        return null;
    }
}

/**
 * Get total user count
 */
async function getUserCount(): Promise<number> {
    try {
        // This would need to be implemented based on how you want to count users
        // For now, we'll use the total_cha leaderboard size as a proxy
        const { kv } = await import('@vercel/kv');
        return await kv.zcard('leaderboard:total_cha');
    } catch (error) {
        console.error('Failed to get user count:', error);
        return 0;
    }
}

/**
 * Batch update leaderboards (for maintenance/migration)
 */
export async function batchUpdateLeaderboards(): Promise<void> {
    try {
        // This function would be used for migrating existing data
        // or bulk updates when needed
        console.log('Batch update of leaderboards would be implemented here');

        // Example implementation:
        // 1. Get all user votes from existing system
        // 2. Process each user's historical data
        // 3. Update leaderboard entries
        // 4. Award retroactive achievements
    } catch (error) {
        console.error('Failed to batch update leaderboards:', error);
        throw error;
    }
} 