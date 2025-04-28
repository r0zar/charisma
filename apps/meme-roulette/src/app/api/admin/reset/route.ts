import { NextResponse } from 'next/server';
import { resetKVForNextSpin } from '@/lib/state';

export async function POST() {
    try {
        await resetKVForNextSpin();
        return NextResponse.json({
            success: true,
            message: 'Spin reset successfully',
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Admin reset API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 