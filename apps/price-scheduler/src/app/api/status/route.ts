/**
 * Scheduler Status API
 * 
 * Provides health and status information about the price scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PriceSeriesStorage } from '@services/prices';
import { getHostUrl } from '@modules/discovery';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export async function GET(request: NextRequest) {
    try {
        if (!BLOB_READ_WRITE_TOKEN) {
            return NextResponse.json({
                status: 'error',
                error: 'BLOB_READ_WRITE_TOKEN not configured'
            }, { status: 500 });
        }

        const storage = new PriceSeriesStorage(BLOB_READ_WRITE_TOKEN);
        
        // Get storage stats and latest snapshot
        const [storageStats, latestSnapshot] = await Promise.all([
            storage.getStorageStats(),
            storage.getLatestSnapshot()
        ]);

        const now = Date.now();
        const lastUpdateAge = latestSnapshot ? now - latestSnapshot.timestamp : null;
        const isHealthy = lastUpdateAge ? lastUpdateAge < 10 * 60 * 1000 : false; // Healthy if updated within 10 minutes

        const status = {
            status: isHealthy ? 'healthy' : 'degraded',
            timestamp: now,
            lastUpdate: latestSnapshot?.timestamp || null,
            lastUpdateAge,
            storage: storageStats,
            latestSnapshot: latestSnapshot ? {
                timestamp: latestSnapshot.timestamp,
                tokenCount: latestSnapshot.prices.size,
                arbitrageOpportunities: latestSnapshot.metadata.arbitrageOpportunities,
                engineStats: latestSnapshot.metadata.engineStats
            } : null,
            environment: {
                INVEST_URL: getHostUrl('invest'),
                SWAP_URL: getHostUrl('swap'),
                NODE_ENV: process.env.NODE_ENV || 'development'
            }
        };

        return NextResponse.json(status);

    } catch (error) {
        console.error('[SchedulerStatus] Error:', error);
        return NextResponse.json({
            status: 'error',
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}