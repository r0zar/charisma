import { NextRequest, NextResponse } from 'next/server';
import { getLockDuration, setLockDuration } from '@/lib/state';
import { verifySignatureAndGetSigner } from '@repo/stacks';

export async function GET() {
    try {
        const duration = await getLockDuration();
        return NextResponse.json({
            duration,
            durationMinutes: Math.round(duration / 60000), // Convert to minutes for convenience
            success: true
        });
    } catch (error) {
        console.error('Admin lock-duration GET API error:', error);
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

        const signer = await verifySignatureAndGetSigner(request, {
            message: 'Set lock duration',
        });

        if (!durationMinutes || typeof durationMinutes !== 'number' || isNaN(durationMinutes)) {
            return NextResponse.json(
                { error: 'Invalid duration provided' },
                { status: 400 }
            );
        }

        // Convert minutes to milliseconds
        const durationMs = durationMinutes * 60 * 1000;

        // Ensure duration is at least 30 seconds
        if (durationMs < 30000) {
            return NextResponse.json(
                { error: 'Lock duration must be at least 30 seconds' },
                { status: 400 }
            );
        }

        await setLockDuration(durationMs);

        return NextResponse.json({
            success: true,
            message: `Lock duration set to ${durationMinutes} minute(s)`,
            duration: durationMs,
            durationMinutes
        });
    } catch (error) {
        console.error('Admin lock-duration POST API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 