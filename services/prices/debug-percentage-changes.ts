#!/usr/bin/env tsx
/**
 * Debug script to test percentage changes fallback
 */

import { PriceSeriesStorage, PriceSeriesAPI } from './src/index';

async function main() {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
        console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is required');
        process.exit(1);
    }

    console.log('🔧 Testing percentage changes fallback...\n');

    try {
        // Initialize storage and API
        const storage = new PriceSeriesStorage(blobToken);
        const priceAPI = new PriceSeriesAPI(storage);

        // Test tokens (same as tokens page uses)
        const testTokenIds = [
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.crystals',
            'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'
        ];

        console.log(`📋 Testing percentage changes for ${testTokenIds.length} tokens`);
        
        // Call getPercentageChanges like the tokens page does
        const changesResult = await priceAPI.getPercentageChanges({
            tokenIds: testTokenIds
        });

        console.log(`✅ Percentage changes result:`, {
            success: changesResult.success,
            cached: changesResult.cached,
            error: changesResult.error
        });

        if (changesResult.success && changesResult.data) {
            console.log('\n📊 Individual token percentage changes:');
            Object.entries(changesResult.data).forEach(([tokenId, changes]) => {
                console.log(`${tokenId.substring(0, 25)}...:`, {
                    change1h: changes.change1h !== null ? `${changes.change1h?.toFixed(2)}%` : 'null',
                    change24h: changes.change24h !== null ? `${changes.change24h?.toFixed(2)}%` : 'null'
                });
            });

            // Check if any percentage changes are non-null
            const hasData = Object.values(changesResult.data).some(changes => 
                changes.change1h !== null || changes.change24h !== null
            );

            console.log(`\n🎯 Summary:`);
            console.log(`- Total tokens tested: ${testTokenIds.length}`);
            console.log(`- Tokens with percentage data: ${Object.values(changesResult.data).filter(changes => changes.change1h !== null || changes.change24h !== null).length}`);
            console.log(`- Fallback working: ${hasData ? '✅ YES' : '❌ NO'}`);

        } else {
            console.log('❌ Failed to get percentage changes:', changesResult.error);
        }

    } catch (error) {
        console.error('❌ Debug script error:', error);
        process.exit(1);
    }
}

main().catch(console.error);