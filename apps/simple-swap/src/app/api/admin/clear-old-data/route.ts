export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { ADMIN_CONFIG } from '@/lib/admin-config';

export async function POST() {
    try {
        console.log('🗑️ Starting old data cleanup process...');

        const cutoffTimestamp = Date.now() - ADMIN_CONFIG.RETENTION_MS;
        const cutoffDate = new Date(cutoffTimestamp);

        console.log(`📅 Removing price data older than: ${cutoffDate.toISOString()}`);

        let cursor = '0';
        let totalKeysProcessed = 0;
        let totalDataPointsRemoved = 0;
        let iterations = 0;
        const maxIterations = 100; // Safety limit

        do {
            const result = await kv.scan(cursor, {
                match: 'price:token:*',
                count: 50
            });

            cursor = result[0];
            const keys = result[1] as string[];

            console.log(`🔍 Processing batch ${iterations + 1}: ${keys.length} keys`);

            // Process each token's price data
            for (const key of keys) {
                try {
                    // Remove old entries from this token's sorted set
                    const removedCount = await kv.zremrangebyscore(key, 0, cutoffTimestamp);
                    totalDataPointsRemoved += removedCount;
                    totalKeysProcessed++;
                } catch (error) {
                    console.error(`❌ Error processing key ${key}:`, error);
                }
            }

            iterations++;
            if (iterations >= maxIterations) {
                console.warn('⚠️ Hit iteration limit, stopping cleanup');
                break;
            }

        } while (cursor !== '0');

        console.log(`✅ Cleanup completed:`);
        console.log(`   - Processed: ${totalKeysProcessed} tokens`);
        console.log(`   - Removed: ${totalDataPointsRemoved} old data points`);
        console.log(`   - Cutoff date: ${cutoffDate.toISOString()}`);

        return NextResponse.json({
            success: true,
            summary: {
                tokensProcessed: totalKeysProcessed,
                dataPointsRemoved: totalDataPointsRemoved,
                cutoffDate: cutoffDate.toISOString(),
                retentionDays: ADMIN_CONFIG.RETENTION_DAYS
            }
        });

    } catch (error) {
        console.error('💥 Error during old data cleanup:', error);
        return NextResponse.json(
            {
                error: 'Failed to clear old data',
                details: error instanceof Error ? error.message : 'Unknown error',
                debugInfo: {
                    timestamp: new Date().toISOString(),
                    env: process.env.NODE_ENV
                }
            },
            { status: 500 }
        );
    }
} 