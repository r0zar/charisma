import { NextRequest, NextResponse } from 'next/server';
import {
    getComprehensiveLeaderboard,
    getUserProfile,
    initializeIntegratedSystem
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

            case 'init':
                return await handleInitialize();

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
 * Handle system initialization
 */
async function handleInitialize() {
    try {
        await initializeIntegratedSystem();

        return NextResponse.json({
            success: true,
            message: 'Leaderboard system initialized successfully'
        });
    } catch (error) {
        console.error('Failed to initialize leaderboard system:', error);
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

// ========================================
// POST - UPDATE USER ACTIVITY
// ========================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, userId, ...data } = body;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId is required' },
                { status: 400 }
            );
        }

        switch (action) {
            case 'record_vote':
                return await handleRecordVote(userId, data);

            case 'complete_round':
                return await handleCompleteRound(data);

            default:
                return NextResponse.json(
                    { success: false, error: 'Invalid action for POST. Supported actions: record_vote, complete_round' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Leaderboard POST API error:', error);
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
 * Handle vote recording (for future integration)
 */
async function handleRecordVote(userId: string, data: any) {
    try {
        const { tokenId, amount } = data;

        if (!tokenId || !amount) {
            return NextResponse.json(
                { success: false, error: 'tokenId and amount are required' },
                { status: 400 }
            );
        }

        // This would integrate with the recordVoteWithLeaderboard function
        // For now, we'll just return a placeholder response
        return NextResponse.json({
            success: true,
            message: 'Vote recording endpoint ready for integration',
            data: { userId, tokenId, amount }
        });
    } catch (error) {
        console.error('Failed to record vote:', error);
        throw error;
    }
}

/**
 * Handle round completion (for future integration)
 */
async function handleCompleteRound(data: any) {
    try {
        const { winningTokenId, winnerRewards } = data;

        if (!winningTokenId) {
            return NextResponse.json(
                { success: false, error: 'winningTokenId is required' },
                { status: 400 }
            );
        }

        // This would integrate with the completeRoundWithLeaderboard function
        // For now, we'll just return a placeholder response
        return NextResponse.json({
            success: true,
            message: 'Round completion endpoint ready for integration',
            data: { winningTokenId, winnerRewards }
        });
    } catch (error) {
        console.error('Failed to complete round:', error);
        throw error;
    }
} 