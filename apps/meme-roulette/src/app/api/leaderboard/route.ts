import { NextRequest, NextResponse } from 'next/server';
import {
    getComprehensiveLeaderboard,
    getUserProfile,
} from '@/lib/leaderboard-integration';
import {
    getUserStats,
    getAchievementDefinitions,
    getUserAchievements
} from '@/lib/leaderboard-kv';

// ========================================
// LEADERBOARD API ENDPOINT
// ========================================

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const action = searchParams.get('action') || 'leaderboard';
        const type = searchParams.get('type') as 'total_cha' | 'total_votes' | 'current_round' || 'total_cha';
        const limit = parseInt(searchParams.get('limit') || '50');
        const userId = searchParams.get('userId');

        switch (action) {
            case 'leaderboard':
                return await handleGetLeaderboard(type, limit);

            case 'user_profile':
                if (!userId) {
                    return NextResponse.json(
                        { success: false, error: 'userId is required for user_profile action' },
                        { status: 400 }
                    );
                }
                return await handleGetUserProfile(userId);

            case 'user_stats':
                if (!userId) {
                    return NextResponse.json(
                        { success: false, error: 'userId is required for user_stats action' },
                        { status: 400 }
                    );
                }
                return await handleGetUserStats(userId);

            case 'achievements':
                return await handleGetAchievements();

            case 'user_achievements':
                if (!userId) {
                    return NextResponse.json(
                        { success: false, error: 'userId is required for user_achievements action' },
                        { status: 400 }
                    );
                }
                return await handleGetUserAchievements(userId);

            default:
                return NextResponse.json(
                    { success: false, error: 'Invalid action. Supported actions: leaderboard, user_profile, user_stats, achievements, user_achievements, init' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Leaderboard API error:', error);
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
 * Handle leaderboard data request
 */
async function handleGetLeaderboard(
    type: 'total_cha' | 'total_votes' | 'current_round',
    limit: number
) {
    try {
        const leaderboardData = await getComprehensiveLeaderboard(type, limit);

        return NextResponse.json({
            success: true,
            data: {
                type,
                limit,
                ...leaderboardData
            }
        });
    } catch (error) {
        console.error('Failed to get leaderboard:', error);
        throw error;
    }
}

/**
 * Handle user profile request (includes stats + rankings)
 */
async function handleGetUserProfile(userId: string) {
    try {
        const userProfile = await getUserProfile(userId);

        return NextResponse.json({
            success: true,
            data: {
                userId,
                ...userProfile
            }
        });
    } catch (error) {
        console.error(`Failed to get user profile for ${userId}:`, error);
        throw error;
    }
}

/**
 * Handle user stats only request
 */
async function handleGetUserStats(userId: string) {
    try {
        const userStats = await getUserStats(userId);

        return NextResponse.json({
            success: true,
            data: {
                userId,
                stats: userStats
            }
        });
    } catch (error) {
        console.error(`Failed to get user stats for ${userId}:`, error);
        throw error;
    }
}


/**
 * Handle achievement definitions request
 */
async function handleGetAchievements() {
    try {
        const achievements = await getAchievementDefinitions();

        return NextResponse.json({
            success: true,
            data: {
                achievements,
                totalCount: achievements.length
            }
        });
    } catch (error) {
        console.error('Failed to get achievement definitions:', error);
        throw error;
    }
}

/**
 * Handle user achievements request
 */
async function handleGetUserAchievements(userId: string) {
    try {
        const userAchievementData = await getUserAchievements(userId);

        return NextResponse.json({
            success: true,
            data: {
                userId,
                ...userAchievementData
            }
        });
    } catch (error) {
        console.error(`Failed to get user achievements for ${userId}:`, error);
        throw error;
    }
}
