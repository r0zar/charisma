import { NextRequest, NextResponse } from 'next/server';
import { initializeIntegratedSystem, getComprehensiveLeaderboard } from '@/lib/leaderboard-integration';
import { getBnsNameForUser } from '@/lib/leaderboard-kv';
import { requireAdmin } from '@/lib/roulette/admin-auth';

/**
 * Admin endpoint for leaderboard management and testing
 */
export async function POST(request: NextRequest) {
    try {
        const denied = await requireAdmin(request);
        if (denied) return denied;

        const body = await request.json();
        const { action } = body;

        switch (action) {
            case 'initialize':
                await initializeIntegratedSystem();
                return NextResponse.json({
                    success: true,
                    message: 'Leaderboard system initialized successfully'
                });

            case 'test_bns':
                const { userId } = body;
                if (!userId) {
                    return NextResponse.json(
                        { error: 'userId required for BNS test' },
                        { status: 400 }
                    );
                }

                const bnsName = await getBnsNameForUser(userId);
                return NextResponse.json({
                    success: true,
                    data: {
                        userId,
                        bnsName: bnsName || 'No BNS name found',
                        hasName: !!bnsName
                    }
                });

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Supported: initialize, test_bns' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Admin leaderboard API error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

/**
 * Get leaderboard stats and overview
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'overview';

        switch (action) {
            case 'overview':
                const [totalCHALeaderboard, totalVotesLeaderboard, currentRoundLeaderboard] = await Promise.all([
                    getComprehensiveLeaderboard('total_cha', 10),
                    getComprehensiveLeaderboard('total_votes', 10),
                    getComprehensiveLeaderboard('current_round', 10)
                ]);

                return NextResponse.json({
                    success: true,
                    data: {
                        totalCHA: {
                            entries: totalCHALeaderboard.entries.length,
                            topUsers: totalCHALeaderboard.entries.slice(0, 3).map(entry => ({
                                rank: entry.rank,
                                displayName: entry.displayName,
                                score: entry.score,
                                hasAchievements: entry.stats.achievements.length > 0
                            }))
                        },
                        totalVotes: {
                            entries: totalVotesLeaderboard.entries.length,
                            topUsers: totalVotesLeaderboard.entries.slice(0, 3).map(entry => ({
                                rank: entry.rank,
                                displayName: entry.displayName,
                                score: entry.score,
                                achievements: entry.stats.achievements.length
                            }))
                        },
                        currentRound: {
                            entries: currentRoundLeaderboard.entries.length,
                            topUsers: currentRoundLeaderboard.entries.slice(0, 3).map(entry => ({
                                rank: entry.rank,
                                displayName: entry.displayName,
                                score: entry.score
                            }))
                        },
                        timestamp: Date.now()
                    }
                });

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Supported: overview' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Admin leaderboard GET API error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
} 