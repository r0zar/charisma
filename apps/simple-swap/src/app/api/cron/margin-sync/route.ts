import { NextResponse } from 'next/server';
import { syncAllMarginAccountPnL } from '@/lib/margin/sync';

export async function POST(req: Request) {
    try {
        console.log('🔄 Starting scheduled margin account P&L sync...');

        await syncAllMarginAccountPnL();

        return NextResponse.json({
            status: 'success',
            message: 'Margin account P&L sync completed',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Margin sync cron error:', error);
        return NextResponse.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to sync margin accounts'
        }, { status: 500 });
    }
} 