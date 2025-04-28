import { NextRequest, NextResponse } from 'next/server';
import { getAllUserVotes, getUserVotes } from '@/lib/state';

export async function GET(request: NextRequest) {
    try {
        // Check if we're requesting a specific user's votes
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (userId) {
            // Get votes for specific user
            const userVotes = await getUserVotes(userId);
            return NextResponse.json({
                success: true,
                votes: userVotes,
                userId,
                timestamp: Date.now()
            });
        } else {
            // Get all votes for all users
            const allVotes = await getAllUserVotes();

            // Count some stats
            const userCount = Object.keys(allVotes).length;
            const totalVotes = Object.values(allVotes).reduce((sum, votes) => sum + votes.length, 0);

            return NextResponse.json({
                success: true,
                votes: allVotes,
                stats: {
                    userCount,
                    totalVotes
                },
                timestamp: Date.now()
            });
        }
    } catch (error) {
        console.error('Admin user-votes API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 