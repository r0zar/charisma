import { NextResponse } from 'next/server';
import { syncUserMarginAccountPnL } from '@/lib/margin/sync';
import { z } from 'zod';

const schema = z.object({
    owner: z.string().min(3)
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { owner } = schema.parse(body);

        console.log(`🔄 Syncing P&L for user: ${owner.substring(0, 8)}...`);

        await syncUserMarginAccountPnL(owner);

        return NextResponse.json({
            status: 'success',
            message: 'User margin account P&L synced',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ User margin sync error:', error);
        return NextResponse.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to sync user margin account'
        }, { status: 500 });
    }
} 