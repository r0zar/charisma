#!/usr/bin/env tsx
/**
 * Debug script to simulate exactly what the tokens page does
 */

import { PriceSeriesStorage, PriceSeriesAPI } from './src/index';

async function main() {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
        console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is required');
        process.exit(1);
    }

    console.log('🔧 Simulating tokens page logic...\n');

    try {
        // Initialize exactly like tokens page
        const storage = new PriceSeriesStorage(blobToken);
        const priceAPI = new PriceSeriesAPI(storage);

        // Simulate the tokens page top 20 tokens logic
        const topTokenIds = [
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
            'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token',
            'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token',
            'SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz',
            'SP2BQ0676YV3F7QBJXS1PT7XA975ZG03XEXS9C8TN.stacksai-stxcity',
            'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.crystals',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken-subnet',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-token-subnet-v1'
        ];

        console.log(`📋 Testing exactly like tokens page - ${topTokenIds.length} tokens`);

        // Call exactly like tokens page does
        const bulkHistoryResult = await priceAPI.getBulkPriceSeries({
            tokenIds: topTokenIds,
            timeframe: '1h',
            limit: 24 // 24 hours of hourly data
        });

        console.log(`✅ Bulk history result:`, {
            success: bulkHistoryResult.success,
            dataKeys: bulkHistoryResult.data ? Object.keys(bulkHistoryResult.data) : [],
            dataPoints: bulkHistoryResult.data ? Object.values(bulkHistoryResult.data).reduce((sum, arr) => sum + arr.length, 0) : 0,
            error: bulkHistoryResult.error
        });

        if (bulkHistoryResult.success && bulkHistoryResult.data) {
            console.log(`\n📊 Individual token results:`);
            Object.entries(bulkHistoryResult.data).forEach(([tokenId, history]) => {
                if (history && history.length > 0) {
                    console.log(`✅ ${tokenId.substring(0, 25)}...: ${history.length} points, sample: ${JSON.stringify(history[0])}`);
                } else {
                    console.log(`❌ ${tokenId.substring(0, 25)}...: NO DATA (length=${history?.length || 0})`);
                }
            });

            // Simulate frontend sparkline data processing
            console.log(`\n📈 Frontend sparkline processing simulation:`);
            Object.entries(bulkHistoryResult.data).forEach(([tokenId, history]) => {
                if (history && Array.isArray(history)) {
                    // This is exactly what token-table.tsx does
                    const sparklineData = history.map(entry => entry.usdPrice || entry.price);
                    
                    console.log(`🔍 ${tokenId.substring(0, 25)}...:`);
                    console.log(`   Raw history entries: ${history.length}`);
                    console.log(`   Sparkline data points: ${sparklineData.length}`);
                    console.log(`   Valid prices: ${sparklineData.filter(p => p != null).length}`);
                    
                    if (sparklineData.length > 0) {
                        console.log(`   Sample prices: [${sparklineData.slice(0, 3).join(', ')}...]`);
                        
                        // Test sparkline component logic
                        if (sparklineData.length === 0) {
                            console.log(`   ❌ Would show: NO SPARKLINE (no data)`);
                        } else {
                            console.log(`   ✅ Would show: SPARKLINE with ${sparklineData.length} points`);
                        }
                    } else {
                        console.log(`   ❌ Would show: NO SPARKLINE (no valid prices)`);
                    }
                }
            });

            // Check if the issue is in the data structure
            console.log(`\n🔍 Data structure analysis:`);
            const firstTokenData = Object.values(bulkHistoryResult.data)[0];
            if (firstTokenData && firstTokenData.length > 0) {
                const sampleEntry = firstTokenData[0];
                console.log(`Sample entry structure:`, Object.keys(sampleEntry));
                console.log(`Has usdPrice: ${sampleEntry.hasOwnProperty('usdPrice')}`);
                console.log(`Has price: ${sampleEntry.hasOwnProperty('price')}`);
                console.log(`usdPrice value: ${sampleEntry.usdPrice}`);
                console.log(`price value: ${(sampleEntry as any).price}`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main().catch(console.error);