import { NextRequest, NextResponse } from 'next/server';
import {
    initializeAchievements,
    checkAndAwardAchievements,
    getUserAchievements,
    awardAchievement,
    getAchievementDefinitions,
    getUserStats
} from '@/lib/leaderboard-kv';
import { kv } from '@vercel/kv';

// Admin-only achievement management endpoints
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        console.log(`[ADMIN] Achievement operation: ${action}`, params);

        switch (action) {
            case 'initialize':
                return await handleInitializeAchievements();

            case 'retroactive_awards':
                return await handleRetroactiveAwards(params);

            case 'bulk_award':
                return await handleBulkAward(params);

            case 'reset_user_achievements':
                return await handleResetUserAchievements(params);

            case 'validate_system':
                return await handleValidateSystem();

            case 'get_statistics':
                return await handleGetStatistics();

            case 'force_check_user':
                return await handleForceCheckUser(params);

            default:
                return NextResponse.json(
                    { success: false, error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('[ADMIN] Achievement API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

/**
 * Initialize achievement definitions (idempotent)
 */
async function handleInitializeAchievements() {
    try {
        await initializeAchievements();

        const achievements = await getAchievementDefinitions();

        return NextResponse.json({
            success: true,
            message: 'Achievement system initialized successfully',
            data: {
                totalAchievements: achievements.length,
                achievements: achievements.map(a => ({ id: a.id, name: a.name, type: a.type, rarity: a.rarity }))
            }
        });
    } catch (error) {
        console.error('[ADMIN] Failed to initialize achievements:', error);
        throw error;
    }
}

/**
 * Retroactively award achievements to all existing users
 */
async function handleRetroactiveAwards(params: { userLimit?: number; dryRun?: boolean }) {
    try {
        const { userLimit = 100, dryRun = false } = params;

        // Get all users from leaderboard entries (they have stats)
        const leaderboardKeys = [
            'leaderboard:total_cha',
            'leaderboard:total_votes'
        ];

        const allUserIds = new Set<string>();

        for (const key of leaderboardKeys) {
            const userIds = await kv.zrange(key, 0, -1);
            userIds.forEach(id => allUserIds.add(id as string));
        }

        const userArray = Array.from(allUserIds).slice(0, userLimit);

        console.log(`[ADMIN] Processing ${userArray.length} users for retroactive awards (dryRun: ${dryRun})`);

        const results = {
            processedUsers: 0,
            totalAwardsGiven: 0,
            userResults: [] as Array<{
                userId: string;
                newAchievements: number;
                error?: string;
            }>
        };

        for (const userId of userArray) {
            try {
                const newAchievements = dryRun
                    ? await simulateAchievementCheck(userId)
                    : await checkAndAwardAchievements(userId);

                results.userResults.push({
                    userId,
                    newAchievements: newAchievements.length
                });

                results.totalAwardsGiven += newAchievements.length;
                results.processedUsers++;

                // Log progress every 10 users
                if (results.processedUsers % 10 === 0) {
                    console.log(`[ADMIN] Processed ${results.processedUsers}/${userArray.length} users`);
                }

            } catch (error) {
                console.error(`[ADMIN] Error processing user ${userId}:`, error);
                results.userResults.push({
                    userId,
                    newAchievements: 0,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Retroactive awards completed (${dryRun ? 'DRY RUN' : 'APPLIED'})`,
            data: results
        });

    } catch (error) {
        console.error('[ADMIN] Failed retroactive awards:', error);
        throw error;
    }
}

/**
 * Helper function to check if user is pioneer (for simulation)
 */
async function isPioneerUserSimulation(userId: string): Promise<boolean> {
    try {
        // Get all user stats to determine pioneer status
        const scanResult = await kv.scan(0, { match: 'user:*:stats', count: 1000 });
        const keys = scanResult[1];

        const allUsers = [];
        for (const key of keys) {
            const stats = await kv.get(key);
            if (stats && typeof stats === 'object' && 'firstActivityTime' in stats && 'userId' in stats) {
                allUsers.push(stats as any);
            }
        }

        // Sort users by firstActivityTime (earliest first)
        const sortedUsers = allUsers
            .filter(user => user.firstActivityTime > 0)
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
 * Simulate achievement check without actually awarding
 */
async function simulateAchievementCheck(userId: string) {
    const stats = await getUserStats(userId);
    const achievements = await getAchievementDefinitions();
    const userAchievementsResult = await kv.get(`user:${userId}:achievements`);
    const userAchievements = Array.isArray(userAchievementsResult) ? userAchievementsResult : [];

    const newAchievements = [];

    for (const achievement of achievements) {
        // Skip if user already has this achievement
        if (userAchievements.some((ua: any) => ua.achievementId === achievement.id)) {
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

            case 'special':
                if (achievement.id === 'pioneer_trader') {
                    // Import the isPioneerUser function or replicate the logic here
                    // For now, let's replicate it to keep this function self-contained
                    shouldAward = await isPioneerUserSimulation(userId);
                }
                break;
        }

        if (shouldAward) {
            newAchievements.push({ achievementId: achievement.id });
        }
    }

    return newAchievements;
}

/**
 * Award a specific achievement to multiple users
 */
async function handleBulkAward(params: { achievementId: string; userIds: string[]; force?: boolean }) {
    try {
        const { achievementId, userIds, force = false } = params;

        if (!achievementId || !userIds || userIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'achievementId and userIds are required' },
                { status: 400 }
            );
        }

        // Validate achievement exists
        const achievements = await getAchievementDefinitions();
        const achievement = achievements.find(a => a.id === achievementId);
        if (!achievement) {
            return NextResponse.json(
                { success: false, error: `Achievement ${achievementId} not found` },
                { status: 404 }
            );
        }

        const results = {
            successCount: 0,
            alreadyHadCount: 0,
            errorCount: 0,
            errors: [] as Array<{ userId: string; error: string }>
        };

        for (const userId of userIds) {
            try {
                const awarded = await awardAchievement(userId, achievementId);
                if (awarded) {
                    results.successCount++;
                } else {
                    results.alreadyHadCount++;
                }
            } catch (error) {
                results.errorCount++;
                results.errors.push({
                    userId,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Bulk award completed for achievement: ${achievement.name}`,
            data: {
                achievement: { id: achievement.id, name: achievement.name },
                results
            }
        });

    } catch (error) {
        console.error('[ADMIN] Failed bulk award:', error);
        throw error;
    }
}

/**
 * Reset achievements for a specific user
 */
async function handleResetUserAchievements(params: { userId: string }) {
    try {
        const { userId } = params;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId is required' },
                { status: 400 }
            );
        }

        // Get current achievements before reset
        const currentAchievements = await getUserAchievements(userId);

        // Clear user achievements
        await kv.del(`user:${userId}:achievements`);

        // Update user stats to reflect cleared achievements
        const stats = await getUserStats(userId);
        stats.achievements = [];
        await kv.set(`user:${userId}:stats`, stats);

        return NextResponse.json({
            success: true,
            message: `Reset achievements for user: ${userId}`,
            data: {
                userId,
                previousAchievementCount: currentAchievements.unlockedCount
            }
        });

    } catch (error) {
        console.error('[ADMIN] Failed to reset user achievements:', error);
        throw error;
    }
}

/**
 * Validate achievement system integrity
 */
async function handleValidateSystem() {
    try {
        const issues = [];
        const statistics = {
            totalAchievements: 0,
            usersWithAchievements: 0,
            totalAchievementsAwarded: 0,
            achievementCounts: {} as Record<string, number>
        };

        // Check achievement definitions
        const achievements = await getAchievementDefinitions();
        statistics.totalAchievements = achievements.length;

        if (achievements.length === 0) {
            issues.push('No achievement definitions found - system may not be initialized');
        }

        // Initialize achievement counts
        achievements.forEach(a => {
            statistics.achievementCounts[a.id] = 0;
        });

        // Scan for user achievement data
        const cursor = '0';
        const pattern = 'user:*:achievements';

        try {
            const scanResult = await kv.scan(0, { match: pattern, count: 1000 });
            const keys = scanResult[1];

            for (const key of keys) {
                const userAchievements = await kv.get(key);
                if (userAchievements && Array.isArray(userAchievements)) {
                    statistics.usersWithAchievements++;
                    statistics.totalAchievementsAwarded += userAchievements.length;

                    // Count individual achievements
                    userAchievements.forEach((ua: any) => {
                        if (ua.achievementId && statistics.achievementCounts.hasOwnProperty(ua.achievementId)) {
                            statistics.achievementCounts[ua.achievementId]++;
                        } else if (ua.achievementId) {
                            issues.push(`User has unknown achievement: ${ua.achievementId}`);
                        }
                    });
                }
            }
        } catch (scanError) {
            issues.push(`Could not scan user achievements: ${scanError}`);
        }

        return NextResponse.json({
            success: true,
            message: 'Achievement system validation completed',
            data: {
                statistics,
                issues,
                isHealthy: issues.length === 0
            }
        });

    } catch (error) {
        console.error('[ADMIN] Failed to validate system:', error);
        throw error;
    }
}

/**
 * Get achievement statistics
 */
async function handleGetStatistics() {
    try {
        const achievements = await getAchievementDefinitions();
        const statistics = {
            totalAchievements: achievements.length,
            achievementsByType: {} as Record<string, number>,
            achievementsByRarity: {} as Record<string, number>,
            achievementCounts: {} as Record<string, number>,
            usersWithAchievements: 0
        };

        // Count by type and rarity
        achievements.forEach(a => {
            statistics.achievementsByType[a.type] = (statistics.achievementsByType[a.type] || 0) + 1;
            statistics.achievementsByRarity[a.rarity] = (statistics.achievementsByRarity[a.rarity] || 0) + 1;
            statistics.achievementCounts[a.id] = 0;
        });

        // Count actual awards (this is expensive, so we limit it)
        try {
            const scanResult = await kv.scan(0, { match: 'user:*:achievements', count: 1000 });
            const keys = scanResult[1];

            for (const key of keys) {
                const userAchievements = await kv.get(key);
                if (userAchievements && Array.isArray(userAchievements)) {
                    statistics.usersWithAchievements++;
                    userAchievements.forEach((ua: any) => {
                        if (ua.achievementId && statistics.achievementCounts.hasOwnProperty(ua.achievementId)) {
                            statistics.achievementCounts[ua.achievementId]++;
                        }
                    });
                }
            }
        } catch (scanError) {
            console.warn('Could not scan all user achievements for statistics:', scanError);
        }

        return NextResponse.json({
            success: true,
            data: {
                statistics,
                achievements: achievements.map(a => ({
                    id: a.id,
                    name: a.name,
                    type: a.type,
                    rarity: a.rarity,
                    threshold: a.threshold,
                    awardedCount: statistics.achievementCounts[a.id]
                }))
            }
        });

    } catch (error) {
        console.error('[ADMIN] Failed to get statistics:', error);
        throw error;
    }
}

/**
 * Force check and award achievements for a specific user
 */
async function handleForceCheckUser(params: { userId: string }) {
    try {
        const { userId } = params;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId is required' },
                { status: 400 }
            );
        }

        const newAchievements = await checkAndAwardAchievements(userId);
        const userAchievements = await getUserAchievements(userId);

        return NextResponse.json({
            success: true,
            message: `Force-checked user: ${userId}`,
            data: {
                userId,
                newAchievementsAwarded: newAchievements.length,
                newAchievements: newAchievements.map(a => a.achievementId),
                totalAchievements: userAchievements.unlockedCount
            }
        });

    } catch (error) {
        console.error('[ADMIN] Failed to force check user:', error);
        throw error;
    }
} 