import { NextRequest, NextResponse } from 'next/server';
import { getRoundDuration, setRoundDuration } from '@/lib/state';

export async function GET() {
    try {
        const duration = await getRoundDuration();
        return NextResponse.json({
            success: true,
            duration,
            durationMinutes: Math.round(duration / 60000),
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Admin round-duration GET error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { durationMinutes } = body;

        if (!durationMinutes || typeof durationMinutes !== 'number' || durationMinutes < 1) {
            return NextResponse.json(
                { error: 'Invalid duration provided. Must be a number greater than or equal to 1.' },
                { status: 400 }
            );
        }

        // Convert minutes to milliseconds
        const durationMs = durationMinutes * 60 * 1000;

        await setRoundDuration(durationMs);

        return NextResponse.json({
            success: true,
            message: `Round duration set to ${durationMinutes} minute(s)`,
            duration: durationMs,
            durationMinutes,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Admin round-duration POST error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 