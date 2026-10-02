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
import type { Vote } from '@/types/spin';
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

        // Earnings accumulate across rounds; wins are counted when the round is drawn
        stats.totalEarnings += realEarnings;
        stats.updatedAt = Date.now();

        await kv.set(USER_STATS_KEY(userId), stats);
        await kv.zadd(LEADERBOARD_EARNINGS, { score: stats.totalEarnings, member: userId });

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