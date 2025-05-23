import { NextRequest, NextResponse } from 'next/server';
import { initializeIntegratedSystem } from '@/lib/leaderboard-integration';

/**
 * Initialize the leaderboard system with achievements and settings
 */
export async function POST(request: NextRequest) {
    try {
        await initializeIntegratedSystem();

        return NextResponse.json({
            success: true,
            message: 'Leaderboard system initialized successfully',
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Failed to initialize leaderboard system:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to initialize leaderboard system',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

/**
 * Check if the leaderboard system is initialized
 */
export async function GET(request: NextRequest) {
    try {
        // Simple health check - try to get leaderboard data
        const { getLeaderboard } = await import('@/lib/leaderboard-kv');
        const leaderboard = await getLeaderboard('total_cha', 1);

        return NextResponse.json({
            success: true,
            message: 'Leaderboard system is operational',
            initialized: true,
            sampleDataCount: leaderboard.length,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Leaderboard system check failed:', error);
        return NextResponse.json(
            {
                success: false,
                initialized: false,
                error: 'Leaderboard system check failed',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
} 