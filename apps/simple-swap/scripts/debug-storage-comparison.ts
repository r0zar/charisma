#!/usr/bin/env tsx

/**
 * Debug script to compare blob storage access between simple-swap and price-scheduler contexts
 * Tests the exact same storage calls to identify why results differ
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local from the app root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { logger } from './logger.js';
import { PriceSeriesAPI, PriceSeriesStorage } from '@services/prices';

async function main() {
    await logger.initialize();
    await logger.info('Starting storage comparison debug test');
    
    // Log environment variable status
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    const blobBaseUrl = process.env.BLOB_BASE_URL;
    await logger.info(`Environment check:`);
    await logger.info(`  BLOB_READ_WRITE_TOKEN: ${blobToken ? 'configured' : 'missing'}`);
    await logger.info(`  BLOB_BASE_URL: ${blobBaseUrl || 'not set'}`);
    if (blobToken) {
        await logger.info(`  Token length: ${blobToken.length} characters`);
    }

    if (!blobToken) {
        await logger.error('BLOB_READ_WRITE_TOKEN not configured');
        process.exit(1);
    }

    try {
        // Test 1: Direct storage access (like simple-swap does)
        await logger.info('\n=== TEST 1: Direct PriceSeriesStorage Access ===');
        const storage = new PriceSeriesStorage(blobToken);
        const priceAPI = new PriceSeriesAPI(storage);

        // Test storage stats
        const storageStats = await storage.getStorageStats();
        await logger.info(`Storage stats: ${JSON.stringify(storageStats, null, 2)}`);

        // Test latest snapshot
        const latestSnapshot = await storage.getLatestSnapshot();
        await logger.info(`Latest snapshot: ${latestSnapshot ? `${latestSnapshot.prices.size} tokens at ${new Date(latestSnapshot.timestamp).toISOString()}` : 'null'}`);

        // Test specific token history - same token that price-scheduler shows
        const testTokenId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
        await logger.info(`\nTesting historical data for: ${testTokenId}`);
        
        // Direct storage getPriceHistory call
        const directHistoryResult = await storage.getPriceHistory(
            testTokenId,
            '1h',
            10
        );
        await logger.info(`Direct storage history result: ${directHistoryResult.length} entries`);
        
        if (directHistoryResult.length > 0) {
            await logger.info(`Sample entry: ${JSON.stringify(directHistoryResult[0], null, 2)}`);
        }

        // API wrapper getPriceHistory call  
        const apiHistoryResult = await priceAPI.getPriceHistory({
            tokenId: testTokenId,
            timeframe: '1h',
            limit: 10
        });
        await logger.info(`API wrapper history result: success=${apiHistoryResult.success}, entries=${apiHistoryResult.data?.length || 0}`);
        
        if (apiHistoryResult.success && apiHistoryResult.data && apiHistoryResult.data.length > 0) {
            await logger.info(`Sample API entry: ${JSON.stringify(apiHistoryResult.data[0], null, 2)}`);
        } else {
            await logger.warn(`API wrapper error: ${apiHistoryResult.error}`);
        }

        // Test 2: Compare with price-scheduler API response
        await logger.info('\n=== TEST 2: Price-Scheduler API Comparison ===');
        
        const priceSchedulerUrl = 'http://localhost:3500/api/v1/series/' + encodeURIComponent(testTokenId);
        try {
            const response = await fetch(priceSchedulerUrl);
            if (response.ok) {
                const schedulerData = await response.json();
                await logger.info(`Price-scheduler API: success=${schedulerData.status}, series entries=${schedulerData.data?.series?.length || 0}`);
                
                if (schedulerData.data?.series?.length > 0) {
                    await logger.info(`Sample scheduler entry: ${JSON.stringify(schedulerData.data.series[0], null, 2)}`);
                }
            } else {
                await logger.warn(`Price-scheduler API error: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            await logger.warn(`Price-scheduler API fetch error: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Test 3: Check blob listing and structure
        await logger.info('\n=== TEST 3: Blob Storage Structure Analysis ===');
        
        try {
            // Check what's actually in the blob storage
            const allSnapshots = await storage.getAllSnapshots();
            await logger.info(`Total snapshots in storage: ${allSnapshots.length}`);
            
            if (allSnapshots.length > 0) {
                const recentSnapshots = allSnapshots.slice(-5); // Last 5 snapshots
                await logger.info(`Recent snapshots:`);
                for (const snapshot of recentSnapshots) {
                    await logger.info(`  - ${new Date(snapshot.timestamp).toISOString()}: ${snapshot.prices.size} tokens`);
                }
                
                // Check if our test token is in the latest snapshot
                const latest = allSnapshots[allSnapshots.length - 1];
                const hasTestToken = latest.prices.has(testTokenId);
                await logger.info(`Latest snapshot contains test token: ${hasTestToken}`);
                
                if (hasTestToken) {
                    const tokenData = latest.prices.get(testTokenId);
                    await logger.info(`Test token data in snapshot: ${JSON.stringify(tokenData, null, 2)}`);
                }
            }
            
        } catch (error) {
            await logger.error(`Blob structure analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Test 4: Raw blob listing
        await logger.info('\n=== TEST 4: Raw Blob File Listing ===');
        try {
            // This would require more direct blob access - let's see what files exist
            const testUrl = `${blobBaseUrl}snapshots/`;
            await logger.info(`Testing blob base structure at: ${testUrl}`);
            
        } catch (error) {
            await logger.warn(`Raw blob listing failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        await logger.success('Storage comparison debug test completed');
        
    } catch (error) {
        await logger.error('Storage comparison debug test failed');
        await logger.error(error instanceof Error ? error.message : String(error));
        
        if (error instanceof Error && error.stack) {
            await logger.debug('Stack trace:');
            await logger.debug(error.stack);
        }
        
        process.exit(1);
    }
}

// Run the script
main().catch(async (error) => {
    await logger.error('Unhandled error in main');
    await logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});