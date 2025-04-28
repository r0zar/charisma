import { NextRequest, NextResponse } from 'next/server';
import { setKVSpinScheduledAt } from '@/lib/state';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { timestamp } = body;

        if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) {
            return NextResponse.json(
                { error: 'Invalid timestamp provided' },
                { status: 400 }
            );
        }

        // Ensure timestamp is in the future
        const now = Date.now();
        if (timestamp <= now) {
            return NextResponse.json(
                { error: 'Timestamp must be in the future' },
                { status: 400 }
            );
        }

        await setKVSpinScheduledAt(timestamp);

        return NextResponse.json({
            success: true,
            message: `Spin time set to: ${new Date(timestamp).toISOString()}`,
            timestamp: now
        });
    } catch (error) {
        console.error('Admin spin-time API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 