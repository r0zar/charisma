#!/usr/bin/env tsx
/**
 * Step-by-step debugging script for sparklines issue
 */

import { PriceSeriesStorage, PriceSeriesAPI } from './src/index';

async function main() {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
        console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is required');
        process.exit(1);
    }

    console.log('🔧 Starting sparklines debug...\n');

    try {
        // Step 1: Initialize storage and API
        console.log('📋 Step 1: Initialize storage and API');
        const storage = new PriceSeriesStorage(blobToken);
        const priceAPI = new PriceSeriesAPI(storage);
        console.log('✅ Storage and API initialized\n');

        // Step 2: Test a single token directly
        const testTokenId = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
        console.log(`📋 Step 2: Test single token directly - ${testTokenId}`);
        
        console.log('🔍 Calling storage.getSnapshotHistory() directly...');
        const directHistory = await storage.getSnapshotHistory(testTokenId, 24);
        console.log(`✅ Direct call result: ${directHistory.length} entries`);
        
        if (directHistory.length > 0) {
            console.log(`   First entry: ${JSON.stringify(directHistory[0])}`);
            console.log(`   Last entry: ${JSON.stringify(directHistory[directHistory.length - 1])}`);
        }
        console.log('');

        // Step 3: Test bulk API call
        console.log('📋 Step 3: Test bulk API call');
        const tokenIds = [testTokenId];
        
        console.log('🔍 Calling priceAPI.getBulkPriceSeries()...');
        const bulkResult = await priceAPI.getBulkPriceSeries({
            tokenIds,
            timeframe: '1h',
            limit: 24
        });
        
        console.log(`✅ Bulk API result: success=${bulkResult.success}`);
        if (bulkResult.data) {
            console.log(`   Data keys: ${Object.keys(bulkResult.data)}`);
            Object.entries(bulkResult.data).forEach(([tokenId, history]) => {
                console.log(`   ${tokenId}: ${history.length} entries`);
                if (history.length > 0) {
                    console.log(`      First: ${JSON.stringify(history[0])}`);
                }
            });
        }
        if (bulkResult.error) {
            console.log(`   Error: ${bulkResult.error}`);
        }
        console.log('');

        // Step 4: Test multiple tokens like the tokens page does
        console.log('📋 Step 4: Test multiple tokens (simulating tokens page)');
        const multipleTokenIds = [
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.crystals',
            'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'
        ];

        console.log(`🔍 Testing ${multipleTokenIds.length} tokens...`);
        const multiResult = await priceAPI.getBulkPriceSeries({
            tokenIds: multipleTokenIds,
            timeframe: '1h',
            limit: 24
        });

        console.log(`✅ Multi-token result: success=${multiResult.success}`);
        if (multiResult.data) {
            let totalDataPoints = 0;
            Object.entries(multiResult.data).forEach(([tokenId, history]) => {
                console.log(`   ${tokenId.substring(0, 20)}...: ${history.length} entries`);
                totalDataPoints += history.length;
            });
            console.log(`   Total data points across all tokens: ${totalDataPoints}`);
        }
        console.log('');

        // Step 5: Check individual token data availability
        console.log('📋 Step 5: Check individual token data in latest snapshot');
        const latest = await storage.getLatestSnapshot();
        if (latest) {
            console.log(`✅ Latest snapshot has ${latest.prices.size} tokens`);
            
            multipleTokenIds.forEach(tokenId => {
                const price = latest.prices.get(tokenId);
                if (price) {
                    console.log(`   ${tokenId.substring(0, 20)}...: $${price.usdPrice} (${price.source})`);
                } else {
                    console.log(`   ${tokenId.substring(0, 20)}...: NOT FOUND in latest snapshot`);
                }
            });
        } else {
            console.log('❌ No latest snapshot found');
        }
        console.log('');

        // Step 6: Manually test snapshot history for each token
        console.log('📋 Step 6: Manual snapshot history test for each token');
        for (const tokenId of multipleTokenIds) {
            console.log(`🔍 Testing ${tokenId.substring(0, 20)}...`);
            
            try {
                const history = await storage.getSnapshotHistory(tokenId, 10);
                console.log(`   Result: ${history.length} entries`);
                
                if (history.length > 0) {
                    const timespan = history.length > 1 ? 
                        Math.round((history[0].timestamp - history[history.length - 1].timestamp) / (1000 * 60 * 60)) : 0;
                    console.log(`   Timespan: ${timespan} hours`);
                    console.log(`   Sample entry: price=$${history[0].usdPrice}, timestamp=${new Date(history[0].timestamp).toISOString()}`);
                }
            } catch (error) {
                console.log(`   Error: ${error}`);
            }
        }

        console.log('\n🎯 Debug Summary:');
        console.log('If getBulkPriceSeries returns empty arrays but getSnapshotHistory works,');
        console.log('then there\'s likely a parameter mismatch in the API call.');
        console.log('Check the method signatures and parameter passing.');

    } catch (error) {
        console.error('❌ Debug script error:', error);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);