import { kv } from '@vercel/kv';
import type { Vote } from '@/types/spin';
import { v4 as uuidv4 } from 'uuid';
import { getPrimaryBnsName } from '@repo/polyglot';

// ========================================
// LEADERBOARD DATA MODEL DESIGN
// ========================================

// --- KV Key Patterns ---

// User Data
const USER_STATS_KEY = (userId: string) => `user:${userId}:stats`;
const USER_ROUNDS_KEY = (userId: string) => `user:${userId}:rounds`;
const USER_ACHIEVEMENTS_KEY = (userId: string) => `user:${userId}:achievements`;

// BNS Name Cache
const BNS_NAME_CACHE_KEY = (userId: string) => `bns:${userId}:name`;

// Leaderboards (Redis Sorted Sets for efficient ranking)
const LEADERBOARD_TOTAL_CHA = 'leaderboard:total_cha';
const LEADERBOARD_TOTAL_VOTES = 'leaderboard:total_votes';
const LEADERBOARD_AVG_VOTE = 'leaderboard:avg_vote';
const LEADERBOARD_BIGGEST_VOTE = 'leaderboard:biggest_vote';
const LEADERBOARD_RECENT_ACTIVITY = 'leaderboard:recent_activity';
const LEADERBOARD_CURRENT_ROUND = 'leaderboard:current_round';
const LEADERBOARD_EARNINGS = 'leaderboard:earnings';

// Round Data
const ROUND_META_KEY = (roundId: string) => `round:${roundId}:meta`;
const ROUND_PARTICIPANTS_KEY = (roundId: string) => `round:${roundId}:participants`;
const ROUND_TOTALS_KEY = (roundId: string) => `round:${roundId}:totals`;
const ROUND_USER_ACTIVITY_KEY = (roundId: string) => `round:${roundId}:user_activity`;

// Global Data
const GLOBAL_STATS_KEY = 'global:stats';
const GLOBAL_CURRENT_ROUND_KEY = 'global:current_round';
const ACHIEVEMENT_DEFINITIONS_KEY = 'achievement:definitions';

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface UserStats {
    userId: string;
    displayName: string;
    totalCHACommitted: number; // Total CHA across all rounds (atomic units)
    totalVotes: number; // Total number of votes placed
    totalRoundsParticipated: number; // Number of rounds participated in
    averageVoteSize: number; // Average CHA per vote (atomic units)
    biggestVote: number; // Largest single vote (atomic units)
    totalEarnings: number; // Total CHA earned from wins (atomic units)
    winCount: number; // Number of rounds won
    lastActivityTime: number; // Timestamp of last vote
    firstActivityTime: number; // Timestamp of first vote
    currentStreak: number; // Current consecutive rounds participated
    maxStreak: number; // Maximum consecutive rounds participated
    achievements: string[]; // Array of achievement IDs
    updatedAt: number; // Last stats update timestamp
}

export interface RoundParticipation {
    roundId: string;
    userId: string;
    chaCommitted: number; // CHA committed in this round (atomic units)
    voteCount: number; // Number of votes in this round
    tokensVoted: string[]; // Array of token IDs voted for
    isWinner: boolean; // Whether user won this round
    earnings: number; // CHA earned from this round (atomic units)
    timestamp: number; // Round end timestamp
}

export interface RoundMetadata {
    roundId: string;
    startTime: number;
    endTime: number;
    winningTokenId: string | null;
    totalCHACommitted: number; // Total CHA in the round (atomic units)
    totalParticipants: number;
    totalVotes: number;
    isATH: boolean; // Whether this round set a new ATH
}

export interface UserAchievement {
    achievementId: string;
    unlockedAt: number;
    roundId?: string; // Round where achievement was unlocked (if applicable)
    value?: number; // Achievement value (e.g., amount for "First 100 CHA" achievement)
}

export interface AchievementDefinition {
    id: string;
    name: string;
    description: string;
    type: 'milestone' | 'streak' | 'special' | 'earnings' | 'social';
    threshold?: number;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface GlobalStats {
    totalUsers: number;
    totalRounds: number;
    totalCHACommitted: number; // All-time total CHA committed (atomic units)
    totalVotes: number;
    athRoundId: string | null;
    athAmount: number; // All-time high round total (atomic units)
    averageRoundSize: number; // Average CHA per round (atomic units)
    lastUpdated: number;
}

// ========================================
// USER STATISTICS FUNCTIONS
// ========================================

/**
 * Get user statistics with fallback to default values
 */
export async function getUserStats(userId: string): Promise<UserStats> {
    try {
        const stats = await kv.get<UserStats>(USER_STATS_KEY(userId));

        if (!stats) {
            // Get display name (BNS name or truncated address)
            const displayName = await getDisplayNameForUser(userId);

            // Return default user stats
            return {
                userId,
                displayName,
                totalCHACommitted: 0,
                totalVotes: 0,
                totalRoundsParticipated: 0,
                averageVoteSize: 0,
                biggestVote: 0,
                totalEarnings: 0,
                winCount: 0,
                lastActivityTime: 0,
                firstActivityTime: 0,
                currentStreak: 0,
                maxStreak: 0,
                achievements: [],
                updatedAt: Date.now()
            };
        }

        // Update display name if it's outdated (fallback to BNS name)
        if (!stats.displayName || stats.displayName === truncateAddress(userId)) {
            stats.displayName = await getDisplayNameForUser(userId);
        }

        return stats;
    } catch (error) {
        console.error(`Failed to get user stats for ${userId}:`, error);
        throw error;
    }
}

/**
 * Update user statistics after a vote
 */
export async function updateUserStatsAfterVote(
    userId: string,
    voteAmount: number,
    roundId: string
): Promise<void> {
    try {
        const stats = await getUserStats(userId);
        const now = Date.now();

        // Update stats
        stats.totalCHACommitted += voteAmount;
        stats.totalVotes += 1;
        stats.averageVoteSize = stats.totalCHACommitted / stats.totalVotes;
        stats.biggestVote = Math.max(stats.biggestVote, voteAmount);
        stats.lastActivityTime = now;
        stats.updatedAt = now;

        // Set first activity time if this is first vote
        if (stats.firstActivityTime === 0) {
            stats.firstActivityTime = now;
        }

        // Update display name to latest BNS name (if available)
        stats.displayName = await getDisplayNameForUser(userId);

        // Use transaction for atomic updates
        const pipeline = kv.multi();

        // Update user stats
        pipeline.set(USER_STATS_KEY(userId), stats);

        // Update leaderboards
        pipeline.zadd(LEADERBOARD_TOTAL_CHA, { score: stats.totalCHACommitted, member: userId });
        pipeline.zadd(LEADERBOARD_TOTAL_VOTES, { score: stats.totalVotes, member: userId });
        pipeline.zadd(LEADERBOARD_AVG_VOTE, { score: stats.averageVoteSize, member: userId });
        pipeline.zadd(LEADERBOARD_BIGGEST_VOTE, { score: stats.biggestVote, member: userId });
        pipeline.zadd(LEADERBOARD_RECENT_ACTIVITY, { score: stats.lastActivityTime, member: userId });

        await pipeline.exec();

        console.log(`Updated stats for user ${userId}: +${voteAmount} CHA`);
    } catch (error) {
        console.error(`Failed to update user stats for ${userId}:`, error);
        throw error;
    }
}

/**
 * Update user statistics after round completion
 */
export async function updateUserStatsAfterRound(
    userId: string,
    roundId: string,
    isWinner: boolean,
    earnings: number = 0
): Promise<void> {
    try {
        const stats = await getUserStats(userId);
        const roundParticipation = await getUserRoundParticipation(userId, roundId);

        if (!roundParticipation) {
            console.warn(`No round participation found for user ${userId} in round ${roundId}`);
            return;
        }

        // Update round-specific stats
        stats.totalRoundsParticipated += 1;

        if (isWinner) {
            stats.winCount += 1;
            stats.totalEarnings += earnings;
        }

        // Update streak logic would go here
        // For now, we'll increment current streak if user participated
        stats.currentStreak += 1;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);

        stats.updatedAt = Date.now();

        const pipeline = kv.multi();

        // Update user stats
        pipeline.set(USER_STATS_KEY(userId), stats);

        // Update earnings leaderboard
        pipeline.zadd(LEADERBOARD_EARNINGS, { score: stats.totalEarnings, member: userId });

        await pipeline.exec();

        console.log(`Updated round completion stats for user ${userId}: round ${roundId}, winner: ${isWinner}`);
    } catch (error) {
        console.error(`Failed to update round completion stats for ${userId}:`, error);
        throw error;
    }
}

// ========================================
// ROUND TRACKING FUNCTIONS
// ========================================

/**
 * Initialize a new round
 */
export async function initializeRound(roundId: string, startTime: number, endTime: number): Promise<void> {
    try {
        const roundMeta: RoundMetadata = {
            roundId,
            startTime,
            endTime,
            winningTokenId: null,
            totalCHACommitted: 0,
            totalParticipants: 0,
            totalVotes: 0,
            isATH: false
        };

        const pipeline = kv.multi();
        pipeline.set(ROUND_META_KEY(roundId), roundMeta);
        pipeline.set(GLOBAL_CURRENT_ROUND_KEY, roundId);

        await pipeline.exec();

        console.log(`Initialized round ${roundId}`);
    } catch (error) {
        console.error(`Failed to initialize round ${roundId}:`, error);
        throw error;
    }
}

/**
 * Record user activity in current round
 */
export async function recordRoundActivity(
    userId: string,
    roundId: string,
    tokenId: string,
    voteAmount: number
): Promise<void> {
    try {
        // Get or create user's round participation
        let participation = await kv.get<RoundParticipation>(
            `${ROUND_USER_ACTIVITY_KEY(roundId)}:${userId}`
        );

        if (!participation) {
            participation = {
                roundId,
                userId,
                chaCommitted: 0,
                voteCount: 0,
                tokensVoted: [],
                isWinner: false,
                earnings: 0,
                timestamp: Date.now()
            };
        }

        // Update participation
        participation.chaCommitted += voteAmount;
        participation.voteCount += 1;

        if (!participation.tokensVoted.includes(tokenId)) {
            participation.tokensVoted.push(tokenId);
        }

        participation.timestamp = Date.now();

        const pipeline = kv.multi();

        // Save user's round participation
        pipeline.set(`${ROUND_USER_ACTIVITY_KEY(roundId)}:${userId}`, participation);

        // Add user to round participants set
        pipeline.sadd(ROUND_PARTICIPANTS_KEY(roundId), userId);

        // Update current round leaderboard
        pipeline.zadd(LEADERBOARD_CURRENT_ROUND, { score: participation.chaCommitted, member: userId });

        await pipeline.exec();

    } catch (error) {
        console.error(`Failed to record round activity for ${userId}:`, error);
        throw error;
    }
}

/**
 * Get user's participation in a specific round
 */
export async function getUserRoundParticipation(
    userId: string,
    roundId: string
): Promise<RoundParticipation | null> {
    try {
        return await kv.get<RoundParticipation>(`${ROUND_USER_ACTIVITY_KEY(roundId)}:${userId}`);
    } catch (error) {
        console.error(`Failed to get round participation for ${userId} in round ${roundId}:`, error);
        return null;
    }
}

// ========================================
// LEADERBOARD QUERY FUNCTIONS
// ========================================

export interface LeaderboardEntry {
    userId: string;
    displayName: string;
    score: number;
    rank: number;
    stats: UserStats;
}

/**
 * Get leaderboard entries with user stats
 */
export async function getLeaderboard(
    type: 'total_cha' | 'total_votes' | 'avg_vote' | 'biggest_vote' | 'recent_activity' | 'current_round' | 'earnings',
    limit: number = 100,
    offset: number = 0
): Promise<LeaderboardEntry[]> {
    try {
        const leaderboardKey = {
            'total_cha': LEADERBOARD_TOTAL_CHA,
            'total_votes': LEADERBOARD_TOTAL_VOTES,
            'avg_vote': LEADERBOARD_AVG_VOTE,
            'biggest_vote': LEADERBOARD_BIGGEST_VOTE,
            'recent_activity': LEADERBOARD_RECENT_ACTIVITY,
            'current_round': LEADERBOARD_CURRENT_ROUND,
            'earnings': LEADERBOARD_EARNINGS
        }[type];

        // Get ranked entries (descending order) using zrange with rev option
        const entries = await kv.zrange(leaderboardKey, offset, offset + limit - 1, {
            withScores: true,
            rev: true
        });

        if (!entries || entries.length === 0) {
            return [];
        }

        // Get user stats for all users in batch
        const userIds = entries.filter((_: any, index: number) => index % 2 === 0) as string[];
        const scores = entries.filter((_: any, index: number) => index % 2 === 1) as number[];

        // Get user stats and display names in parallel
        const [userStatsArray, displayNames] = await Promise.all([
            Promise.all(userIds.map(userId => getUserStats(userId))),
            getDisplayNamesForUsers(userIds)
        ]);

        // Build leaderboard entries with BNS names
        const leaderboardEntries: LeaderboardEntry[] = userIds.map((userId, index) => ({
            userId,
            displayName: displayNames[userId] || userStatsArray[index].displayName,
            score: scores[index],
            rank: offset + index + 1,
            stats: {
                ...userStatsArray[index],
                displayName: displayNames[userId] || userStatsArray[index].displayName
            }
        }));

        return leaderboardEntries;
    } catch (error) {
        console.error(`Failed to get ${type} leaderboard:`, error);
        return [];
    }
}

/**
 * Get user's rank in a specific leaderboard
 */
export async function getUserRank(
    userId: string,
    type: 'total_cha' | 'total_votes' | 'avg_vote' | 'biggest_vote' | 'recent_activity' | 'current_round' | 'earnings'
): Promise<number | null> {
    try {
        const leaderboardKey = {
            'total_cha': LEADERBOARD_TOTAL_CHA,
            'total_votes': LEADERBOARD_TOTAL_VOTES,
            'avg_vote': LEADERBOARD_AVG_VOTE,
            'biggest_vote': LEADERBOARD_BIGGEST_VOTE,
            'recent_activity': LEADERBOARD_RECENT_ACTIVITY,
            'current_round': LEADERBOARD_CURRENT_ROUND,
            'earnings': LEADERBOARD_EARNINGS
        }[type];

        const rank = await kv.zrank(leaderboardKey, userId);
        if (rank === null) return null;

        // For descending order, we need to get total count and calculate reverse rank
        const totalCount = await kv.zcard(leaderboardKey);
        return totalCount - rank; // Convert to 1-based ranking in descending order
    } catch (error) {
        console.error(`Failed to get user rank for ${userId}:`, error);
        return null;
    }
}

// ========================================
// ACHIEVEMENT SYSTEM
// ========================================

/**
 * Initialize achievement definitions
 */
export async function initializeAchievements(): Promise<void> {
    const achievements: AchievementDefinition[] = [
        // Milestone Achievements
        {
            id: 'first_vote',
            name: 'First Vote',
            description: 'Place your first vote in meme roulette',
            type: 'milestone',
            threshold: 1,
            icon: '🎯',
            rarity: 'common'
        },
        {
            id: 'cha_100',
            name: 'Century Club',
            description: 'Commit 100 CHA total',
            type: 'milestone',
            threshold: 100 * 10 ** 6, // 100 CHA in atomic units
            icon: '💯',
            rarity: 'common'
        },
        {
            id: 'cha_1000',
            name: 'Thousand Strong',
            description: 'Commit 1,000 CHA total',
            type: 'milestone',
            threshold: 1000 * 10 ** 6,
            icon: '🚀',
            rarity: 'rare'
        },
        {
            id: 'big_bet_100',
            name: 'High Roller',
            description: 'Place a single vote of 100+ CHA',
            type: 'milestone',
            threshold: 100 * 10 ** 6,
            icon: '🎰',
            rarity: 'rare'
        },
        {
            id: 'whale_500',
            name: 'Crypto Whale',
            description: 'Place a single vote of 500+ CHA',
            type: 'milestone',
            threshold: 500 * 10 ** 6,
            icon: '🐋',
            rarity: 'epic'
        },

        // Streak Achievements
        {
            id: 'streak_5',
            name: 'Consistent Player',
            description: 'Participate in 5 consecutive rounds',
            type: 'streak',
            threshold: 5,
            icon: '🔥',
            rarity: 'common'
        },
        {
            id: 'streak_20',
            name: 'Dedicated Trader',
            description: 'Participate in 20 consecutive rounds',
            type: 'streak',
            threshold: 20,
            icon: '⚡',
            rarity: 'epic'
        },

        // Special Achievements
        {
            id: 'first_winner',
            name: 'Beginner\'s Luck',
            description: 'Win on your first round',
            type: 'special',
            icon: '🍀',
            rarity: 'rare'
        },
        {
            id: 'ath_participant',
            name: 'History Maker',
            description: 'Participate in an ATH-setting round',
            type: 'special',
            icon: '📈',
            rarity: 'legendary'
        },

        // New Theme-Based Achievements
        {
            id: 'pioneer_trader',
            name: 'Meme Pioneer',
            description: 'One of the first 100 users to join the roulette',
            type: 'special',
            icon: '🎪',
            rarity: 'legendary'
        },
        {
            id: 'viral_spreader',
            name: 'Hype Spreader',
            description: 'Bring a friend into the meme madness',
            type: 'social',
            icon: '🚀',
            rarity: 'rare'
        },
        {
            id: 'degen_starter',
            name: 'Degen Starter',
            description: 'Vote with at least 50 CHA in a single round',
            type: 'milestone',
            threshold: 50 * 10 ** 6, // 50 CHA in atomic units
            icon: '🎰',
            rarity: 'common'
        }
    ];

    await kv.set(ACHIEVEMENT_DEFINITIONS_KEY, achievements);
    console.log('Achievement definitions initialized');
}

/**
 * Check if a user is among the first 100 users (pioneer)
 */
async function isPioneerUser(userId: string): Promise<boolean> {
    try {
        // Get all user stats to determine pioneer status
        const allUsers = await getAllUserStats();

        // Sort users by firstActivityTime (earliest first)
        const sortedUsers = allUsers
            .filter(user => user.firstActivityTime > 0) // Only users who have actually participated
            .sort((a, b) => a.firstActivityTime - b.firstActivityTime);

        // Check if this user is in the first 100
        const userIndex = sortedUsers.findIndex(user => user.userId === userId);
        return userIndex !== -1 && userIndex < 100;
    } catch (error) {
        console.error(`Failed to check pioneer status for ${userId}:`, error);
        return false;
    }
}

/**
 * Get all user stats (helper function for pioneer check)
 */
async function getAllUserStats(): Promise<UserStats[]> {
    try {
        // Get all keys matching user stats pattern
        const keys = await kv.keys('user:*:stats');

        // Fetch all user stats in parallel
        const userStatsPromises = keys.map(key => kv.get<UserStats>(key));
        const userStatsResults = await Promise.all(userStatsPromises);

        // Filter out null results and return
        return userStatsResults.filter((stats): stats is UserStats => stats !== null);
    } catch (error) {
        console.error('Failed to get all user stats:', error);
        return [];
    }
}

/**
 * Check and award achievements for a user
 */
export async function checkAndAwardAchievements(userId: string): Promise<UserAchievement[]> {
    try {
        const stats = await getUserStats(userId);
        const achievements = await kv.get<AchievementDefinition[]>(ACHIEVEMENT_DEFINITIONS_KEY) || [];
        const userAchievements = await kv.get<UserAchievement[]>(USER_ACHIEVEMENTS_KEY(userId)) || [];

        const newAchievements: UserAchievement[] = [];
        const now = Date.now();

        for (const achievement of achievements) {
            // Skip if user already has this achievement
            if (userAchievements.some(ua => ua.achievementId === achievement.id)) {
                continue;
            }

            let shouldAward = false;

            switch (achievement.type) {
                case 'milestone':
                    if (achievement.id === 'first_vote' && stats.totalVotes >= 1) {
                        shouldAward = true;
                    } else if (achievement.id.startsWith('cha_') && stats.totalCHACommitted >= (achievement.threshold || 0)) {
                        shouldAward = true;
                    } else if (achievement.id.startsWith('big_bet_') && stats.biggestVote >= (achievement.threshold || 0)) {
                        shouldAward = true;
                    } else if (achievement.id.startsWith('whale_') && stats.biggestVote >= (achievement.threshold || 0)) {
                        shouldAward = true;
                    } else if (achievement.id === 'degen_starter' && stats.biggestVote >= (achievement.threshold || 0)) {
                        shouldAward = true;
                    }
                    break;

                case 'streak':
                    if (stats.currentStreak >= (achievement.threshold || 0)) {
                        shouldAward = true;
                    }
                    break;

                // Special achievements would need additional context
                case 'special':
                    // Pioneer trader achievement - one of first 100 users
                    if (achievement.id === 'pioneer_trader') {
                        shouldAward = await isPioneerUser(userId);
                    }
                    break;

                case 'social':
                    // These would typically be awarded through external systems
                    // For 'viral_spreader', this would be triggered when referral system detects a successful referral
                    break;
            }

            if (shouldAward) {
                const newAchievement: UserAchievement = {
                    achievementId: achievement.id,
                    unlockedAt: now,
                    value: achievement.threshold
                };

                newAchievements.push(newAchievement);
                userAchievements.push(newAchievement);
            }
        }

        if (newAchievements.length > 0) {
            // Update user's achievements
            await kv.set(USER_ACHIEVEMENTS_KEY(userId), userAchievements);

            // Update user stats with new achievement count
            stats.achievements = userAchievements.map(ua => ua.achievementId);
            await kv.set(USER_STATS_KEY(userId), stats);

            console.log(`Awarded ${newAchievements.length} new achievements to user ${userId}`);
        }

        return newAchievements;
    } catch (error) {
        console.error(`Failed to check achievements for ${userId}:`, error);
        return [];
    }
}

/**
 * Get all achievement definitions
 */
export async function getAchievementDefinitions(): Promise<AchievementDefinition[]> {
    try {
        return await kv.get<AchievementDefinition[]>(ACHIEVEMENT_DEFINITIONS_KEY) || [];
    } catch (error) {
        console.error('Failed to get achievement definitions:', error);
        return [];
    }
}

/**
 * Get user's achievements with definition details
 */
export async function getUserAchievements(userId: string): Promise<{
    achievements: UserAchievement[];
    definitions: AchievementDefinition[];
    unlockedCount: number;
    totalCount: number;
}> {
    try {
        const [userAchievementsResult, allDefinitions] = await Promise.all([
            kv.get<UserAchievement[]>(USER_ACHIEVEMENTS_KEY(userId)),
            getAchievementDefinitions()
        ]);

        const userAchievements = userAchievementsResult || [];

        return {
            achievements: userAchievements,
            definitions: allDefinitions,
            unlockedCount: userAchievements.length,
            totalCount: allDefinitions.length
        };
    } catch (error) {
        console.error(`Failed to get user achievements for ${userId}:`, error);
        return {
            achievements: [],
            definitions: [],
            unlockedCount: 0,
            totalCount: 0
        };
    }
}

/**
 * Award a specific achievement to a user (for admin/special cases)
 */
export async function awardAchievement(userId: string, achievementId: string, roundId?: string): Promise<boolean> {
    try {
        const userAchievements = await kv.get<UserAchievement[]>(USER_ACHIEVEMENTS_KEY(userId)) || [];

        // Check if user already has this achievement
        if (userAchievements.some(ua => ua.achievementId === achievementId)) {
            console.log(`User ${userId} already has achievement ${achievementId}`);
            return false;
        }

        const newAchievement: UserAchievement = {
            achievementId,
            unlockedAt: Date.now(),
            roundId
        };

        userAchievements.push(newAchievement);
        await kv.set(USER_ACHIEVEMENTS_KEY(userId), userAchievements);

        // Update user stats
        const stats = await getUserStats(userId);
        stats.achievements = userAchievements.map(ua => ua.achievementId);
        await kv.set(USER_STATS_KEY(userId), stats);

        console.log(`Manually awarded achievement ${achievementId} to user ${userId}`);
        return true;
    } catch (error) {
        console.error(`Failed to award achievement ${achievementId} to ${userId}:`, error);
        return false;
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Helper function to truncate address for display
 */
function truncateAddress(address: string): string {
    if (!address) return 'Anonymous';
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get current round ID
 */
export async function getCurrentRoundId(): Promise<string | null> {
    return await kv.get<string>(GLOBAL_CURRENT_ROUND_KEY);
}

/**
 * Clean up old round data (for maintenance)
 */
export async function cleanupOldRounds(keepRecentRounds: number = 100): Promise<void> {
    try {
        // This would implement cleanup logic for old round data
        // For now, we'll just log the intent
        console.log(`Cleanup: Would keep ${keepRecentRounds} most recent rounds`);

        // Implementation would:
        // 1. Get list of all round IDs
        // 2. Sort by timestamp 
        // 3. Delete data for rounds beyond keepRecentRounds
        // 4. Update global stats accordingly
    } catch (error) {
        console.error('Failed to cleanup old rounds:', error);
    }
}

/**
 * Initialize the leaderboard system
 */
export async function initializeLeaderboardSystem(): Promise<void> {
    try {
        // Initialize achievement definitions
        await initializeAchievements();

        // Initialize global stats if they don't exist
        const globalStats = await kv.get<GlobalStats>(GLOBAL_STATS_KEY);
        if (!globalStats) {
            const initialStats: GlobalStats = {
                totalUsers: 0,
                totalRounds: 0,
                totalCHACommitted: 0,
                totalVotes: 0,
                athRoundId: null,
                athAmount: 0,
                averageRoundSize: 0,
                lastUpdated: Date.now()
            };

            await kv.set(GLOBAL_STATS_KEY, initialStats);
        }

        console.log('Leaderboard system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize leaderboard system:', error);
        throw error;
    }
}

// ========================================
// BNS NAME UTILITIES
// ========================================

/**
 * Get or fetch BNS name for a user address with enhanced caching
 */
export async function getBnsNameForUser(userId: string): Promise<string | null> {
    try {
        // Check cache first
        const cachedName = await kv.get<string>(BNS_NAME_CACHE_KEY(userId));

        if (cachedName !== null) {
            return cachedName || null; // Empty string means no BNS name found
        }

        // Fetch from BNS API
        const bnsName = await getPrimaryBnsName(userId, 'stacks');

        if (bnsName) {
            // Cache BNS names for 30 days (BNS names rarely change)
            await kv.set(BNS_NAME_CACHE_KEY(userId), bnsName, {
                ex: 30 * 24 * 3600 // 30 days
            });
            console.log(`🏷️ Cached BNS name for ${userId}: ${bnsName} (30 days)`);
        } else {
            // Cache "no BNS name" for 7 days (shorter in case they register one)
            await kv.set(BNS_NAME_CACHE_KEY(userId), '', {
                ex: 7 * 24 * 3600 // 7 days
            });
        }

        return bnsName;
    } catch (error) {
        console.error(`Failed to get BNS name for ${userId}:`, error);
        // Cache failure to avoid repeated API calls (much shorter for errors)
        await kv.set(BNS_NAME_CACHE_KEY(userId), '', { ex: 1800 }); // Cache failure for 30 minutes
        return null;
    }
}

/**
 * Get display name for a user, preferring BNS name over truncated address
 */
export async function getDisplayNameForUser(userId: string): Promise<string> {
    try {
        const bnsName = await getBnsNameForUser(userId);
        return bnsName || truncateAddress(userId);
    } catch (error) {
        console.error(`Failed to get display name for ${userId}:`, error);
        return truncateAddress(userId);
    }
}

/**
 * Batch get display names for multiple users with optimized caching
 */
export async function getDisplayNamesForUsers(userIds: string[]): Promise<Record<string, string>> {
    try {
        const displayNames: Record<string, string> = {};
        const uncachedUserIds: string[] = [];

        // First, check cache for all users in batch
        const cacheKeys = userIds.map(userId => BNS_NAME_CACHE_KEY(userId));
        const cachedResults = await kv.mget<string[]>(...cacheKeys);

        // Process cached results and identify uncached users
        userIds.forEach((userId, index) => {
            const cachedName = cachedResults[index];
            if (cachedName !== null) {
                // Use cached result (empty string means no BNS name)
                displayNames[userId] = cachedName || truncateAddress(userId);
            } else {
                // Need to fetch from API
                uncachedUserIds.push(userId);
            }
        });

        console.log(`🚀 BNS Batch: ${userIds.length - uncachedUserIds.length}/${userIds.length} served from cache`);

        // Fetch remaining users from API in parallel (but rate-limited)
        if (uncachedUserIds.length > 0) {
            console.log(`🔍 BNS Batch: Fetching ${uncachedUserIds.length} names from API`);

            // Process in smaller batches to avoid overwhelming the BNS API
            const BATCH_SIZE = 5;
            const batches = [];
            for (let i = 0; i < uncachedUserIds.length; i += BATCH_SIZE) {
                batches.push(uncachedUserIds.slice(i, i + BATCH_SIZE));
            }

            for (const batch of batches) {
                const batchPromises = batch.map(async (userId) => {
                    try {
                        const bnsName = await getPrimaryBnsName(userId, 'stacks');

                        // Cache the result
                        if (bnsName) {
                            await kv.set(BNS_NAME_CACHE_KEY(userId), bnsName, {
                                ex: 30 * 24 * 3600 // 30 days
                            });
                            return { userId, displayName: bnsName };
                        } else {
                            await kv.set(BNS_NAME_CACHE_KEY(userId), '', {
                                ex: 7 * 24 * 3600 // 7 days  
                            });
                            return { userId, displayName: truncateAddress(userId) };
                        }
                    } catch (error) {
                        console.error(`Failed to get BNS for ${userId}:`, error);
                        // Cache failure
                        await kv.set(BNS_NAME_CACHE_KEY(userId), '', { ex: 1800 });
                        return { userId, displayName: truncateAddress(userId) };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                batchResults.forEach(({ userId, displayName }) => {
                    displayNames[userId] = displayName;
                });

                // Small delay between batches to be nice to the API
                if (batches.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }

        return displayNames;
    } catch (error) {
        console.error('Failed to get batch display names:', error);
        // Fallback to truncated addresses
        const fallbackNames: Record<string, string> = {};
        userIds.forEach(userId => {
            fallbackNames[userId] = truncateAddress(userId);
        });
        return fallbackNames;
    }
} 