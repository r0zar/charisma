#!/usr/bin/env tsx
/**
 * Debug script to test orchestrator initialization fix
 */

import { PriceServiceOrchestrator } from './src/index';

async function main() {
    console.log('🔧 Testing orchestrator initialization fix...\n');

    try {
        // Initialize orchestrator
        const orchestrator = new PriceServiceOrchestrator();

        // Test multiple token calculations like the scheduler does
        const testTokenIds = [
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.crystals',
            'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'
        ];

        console.log(`📋 Testing bulk calculation for ${testTokenIds.length} tokens`);
        console.log('Expected: Single initialization, no re-initialization per token\n');
        
        const startTime = Date.now();
        
        // This should trigger initialization ONCE for all tokens
        const result = await orchestrator.calculateMultipleTokenPrices(testTokenIds, {
            useCache: false,
            batchSize: 5
        });

        const totalTime = Date.now() - startTime;

        console.log(`✅ Bulk calculation result:`, {
            success: result.success,
            successCount: result.prices.size,
            errorCount: result.errors.size,
            totalTime: `${totalTime}ms`,
            engineStats: result.debugInfo?.engineStats
        });

        if (result.success) {
            console.log('\n📊 Individual results:');
            for (const [tokenId, price] of result.prices) {
                console.log(`${tokenId.substring(0, 25)}...: $${price.usdPrice.toFixed(6)} (${price.source})`);
            }
        }

        if (result.errors.size > 0) {
            console.log('\n❌ Errors:');
            for (const [tokenId, error] of result.errors) {
                console.log(`${tokenId.substring(0, 25)}...: ${error}`);
            }
        }

        console.log(`\n🎯 Performance Summary:`);
        console.log(`- Total tokens: ${testTokenIds.length}`);
        console.log(`- Total time: ${totalTime}ms`);
        console.log(`- Average per token: ${(totalTime / testTokenIds.length).toFixed(1)}ms`);
        console.log(`- Expected improvement: No re-initialization spam`);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

main().catch(console.error);