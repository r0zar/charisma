import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(request: NextRequest) {
    try {
        const cronStatus = await kv.get('cron:achievements:status');

        let status = 'Unknown';
        let lastRun = null;
        let message = 'No data available';
        let details = {};

        if (cronStatus) {
            const statusData = cronStatus as any;
            status = statusData.status || 'Unknown';
            lastRun = statusData.lastRun;
            message = statusData.message || 'No message';
            details = {
                processedUsers: statusData.processedUsers || 0,
                totalAwardsGiven: statusData.totalAwardsGiven || 0,
                errors: statusData.errors || 0,
                duration: statusData.duration || 0
            };

            // Check if the last run was more than 15 minutes ago (should run every 10 minutes)
            if (lastRun && Date.now() - lastRun > 15 * 60 * 1000) {
                status = 'Stale';
                message = 'Last run was more than 15 minutes ago';
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                status,
                lastRun,
                message,
                details,
                nextExpectedRun: lastRun ? lastRun + (10 * 60 * 1000) : null
            }
        });
    } catch (error) {
        console.error('Failed to get cron status:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to get cron status',
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
} 