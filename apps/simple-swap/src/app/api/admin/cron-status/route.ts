export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { ADMIN_CONFIG } from '@/lib/admin-config';

export async function GET() {
    try {
        console.log('🔍 Checking cron job health status...');

        // Check 1: Can we access the KV store?
        let kvHealthy = false;
        try {
            await kv.ping();
            kvHealthy = true;
        } catch (error) {
            console.error('❌ KV store is not accessible:', error);
        }

        // Check 2: Do we have recent price data?
        let hasRecentData = false;
        let lastDataTimestamp = null;
        let trackedTokensCount = 0;

        if (kvHealthy) {
            try {
                // Get a sample of tokens to check for recent updates
                const result = await kv.scan('0', {
                    match: 'price:token:*',
                    count: 5 // Just check a few tokens
                });

                const sampleKeys = result[1] as string[];
                trackedTokensCount = sampleKeys.length;

                if (sampleKeys.length > 0) {
                    // Check the most recent update across sample tokens
                    const recentUpdates = await Promise.all(
                        sampleKeys.map(async (key) => {
                            try {
                                const lastEntry = await kv.zrange(key, -1, -1, { withScores: true });
                                return lastEntry.length > 1 ? Number(lastEntry[1]) : 0;
                            } catch {
                                return 0;
                            }
                        })
                    );

                    const mostRecentTimestamp = Math.max(...recentUpdates);
                    if (mostRecentTimestamp > 0) {
                        lastDataTimestamp = new Date(mostRecentTimestamp).toISOString();
                        const timeSinceLastUpdate = Date.now() - mostRecentTimestamp;

                        // Consider data recent if it's less than 3x the cron frequency
                        const maxAcceptableAge = ADMIN_CONFIG.CRON_FREQUENCY_MINUTES * 3 * 60 * 1000;
                        hasRecentData = timeSinceLastUpdate < maxAcceptableAge;
                    }
                }
            } catch (error) {
                console.error('❌ Error checking recent data:', error);
            }
        }

        // Determine overall status
        let status = 'unknown';
        let details = '';

        if (!kvHealthy) {
            status = 'error';
            details = 'KV store is not accessible';
        } else if (trackedTokensCount === 0) {
            status = 'inactive';
            details = 'No price data found - cron may not have run yet';
        } else if (!hasRecentData) {
            status = 'stale';
            details = `Last update: ${lastDataTimestamp ? new Date(lastDataTimestamp).toLocaleString() : 'unknown'}`;
        } else {
            status = 'active';
            details = `${trackedTokensCount} tokens tracked, last update: ${lastDataTimestamp ? new Date(lastDataTimestamp).toLocaleString() : 'unknown'}`;
        }

        console.log(`✅ Cron status check completed: ${status}`);

        return NextResponse.json({
            status,
            details,
            checks: {
                kvHealthy,
                hasRecentData,
                trackedTokensCount,
                lastDataTimestamp
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('💥 Error during cron status check:', error);
        return NextResponse.json(
            {
                status: 'error',
                details: 'Failed to check cron status',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
} 