import { NextRequest, NextResponse } from 'next/server';

export interface HistoricSpinResult {
    roundId: string;
    startTime: number;
    endTime: number;
    winningTokenId: string | null;
    winningTokenInfo?: {
        name: string;
        symbol: string;
        image?: string;
    };
    totalCHA: number;
    totalParticipants: number;
    totalVotes: number;
    tokenBets: Record<string, number>;
    isATH: boolean;
    roundDuration: number;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // TODO: Implement real historic data storage
        // For now, return empty results since we don't have historic data storage yet
        return NextResponse.json({
            success: true,
            results: [], // No historic data available yet
            pagination: {
                limit,
                offset,
                total: 0
            },
            message: 'Historic data collection will begin with future rounds. Start playing to create history!'
        });
    } catch (error) {
        console.error('Failed to fetch historic spins:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 