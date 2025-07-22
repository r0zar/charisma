/**
 * Price Blob Status Test
 * 
 * Shows the current state of our price blob storage and generates new data
 */

import { describe, it, expect } from 'vitest';
import { OraclePriceEngine } from '../engines/oracle-price-engine';
import { KrakenOracleAdapter, CoinGeckoOracleAdapter, InvestAdapter, STXToolsOracleAdapter } from '../oracles';
import { SimpleBlobStorage } from '../price-series/simple-blob-storage';

describe('Current Price Blob Status', () => {
  it('should show current blob status and generate fresh Oracle-based data', async () => {
    console.log('📊 Current Price Blob Status Analysis');
    console.log('=====================================\n');
    
    // Create blob storage to check existing data
    const blobStorage = new SimpleBlobStorage();
    
    console.log('💾 Checking existing blob storage...');
    
    // Test tokens we're interested in
    const testTokens = [
      'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', // sBTC
      '.stx', // STX
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token', // DIKO
      'SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz', // PEPE
      'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token' // WELSH
    ];
    
    console.log('\n🔍 Existing Blob Data:');
    let existingCount = 0;
    
    for (const tokenId of testTokens) {
      try {
        const stored = await blobStorage.getCurrentPrice(tokenId);
        if (stored) {
          existingCount++;
          const shortId = tokenId.split('.')[1] || tokenId;
          console.log(`   ✅ ${shortId}: $${stored.usdPrice.toFixed(6)} (${new Date(stored.timestamp).toLocaleString()})`);
          console.log(`      Source: ${stored.source}, Confidence: ${stored.confidence || 'N/A'}`);
        } else {
          const shortId = tokenId.split('.')[1] || tokenId;
          console.log(`   ❌ ${shortId}: No data in blob storage`);
        }
      } catch (error) {
        const shortId = tokenId.split('.')[1] || tokenId;
        console.log(`   ⚠️ ${shortId}: Error reading - ${error instanceof Error ? error.message : error}`);
      }
    }
    
    console.log(`\n📈 Existing blob contains ${existingCount}/${testTokens.length} test tokens`);
    
    // Now generate fresh Oracle-based data
    console.log('\n🔮 Generating Fresh Oracle-Based Price Data:');
    
    const engine = new OraclePriceEngine(undefined, blobStorage);
    
    // Register all oracle adapters
    engine.registerAdapter(new KrakenOracleAdapter({ timeoutMs: 10000 }));
    engine.registerAdapter(new CoinGeckoOracleAdapter({ timeoutMs: 10000 }));
    engine.registerAdapter(new InvestAdapter());
    engine.registerAdapter(new STXToolsOracleAdapter());
    
    console.log('✅ Oracle engine configured with 4 adapters');
    
    // Get fresh prices for our test tokens
    const freshPrices = new Map();
    let successCount = 0;
    
    console.log('\n💰 Fresh Oracle Pricing Results:');
    
    for (const tokenId of testTokens) {
      const shortId = tokenId.split('.')[1] || tokenId;
      console.log(`\n   📊 ${shortId} (${tokenId}):`);
      
      try {
        const result = await engine.getPrice(tokenId);
        
        if (result) {
          freshPrices.set(tokenId, result);
          successCount++;
          
          console.log(`      ✅ Price: $${result.price.usdPrice.toFixed(6)}`);
          console.log(`      🔄 sBTC Ratio: ${result.price.sbtcRatio.toFixed(8)}`);
          console.log(`      📈 Successful oracles: ${result.oracleResults.filter(r => r.success).length}/${result.oracleResults.length}`);
          
          // Show which oracles succeeded
          result.oracleResults.forEach(oracleResult => {
            if (oracleResult.success) {
              console.log(`         ✅ ${oracleResult.adapterName}: $${oracleResult.price?.toFixed(6)}`);
            } else {
              console.log(`         ❌ ${oracleResult.adapterName}: ${oracleResult.error}`);
            }
          });
          
        } else {
          console.log(`      ❌ No price available from any oracle`);
        }
        
      } catch (error) {
        console.log(`      💥 Error: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    console.log(`\n📊 Fresh Oracle Results: ${successCount}/${testTokens.length} tokens priced successfully`);
    
    // Save snapshot if we have new data
    if (freshPrices.size > 0) {
      console.log('\n💾 Saving fresh Oracle data to blob storage...');
      try {
        await engine.saveSnapshot(freshPrices);
        console.log(`✅ Saved ${freshPrices.size} fresh prices to blob storage`);
      } catch (error) {
        console.log(`❌ Failed to save snapshot: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    // Compare old vs new data
    console.log('\n🔄 Comparison Summary:');
    console.log(`   Existing blob entries: ${existingCount}`);
    console.log(`   Fresh oracle prices: ${successCount}`);
    console.log(`   Oracle adapters: 4 (Kraken, CoinGecko, INVEST, STXTools)`);
    console.log(`   Architecture: Simplified oracle aggregation`);
    
    // Show blob structure summary
    console.log('\n🏗️ Current Blob Architecture:');
    console.log(`   • Oracle-based pricing engine`);
    console.log(`   • Multi-source price aggregation`);
    console.log(`   • Real-time oracle adapter results`);
    console.log(`   • Automatic price averaging`);
    console.log(`   • Integrated blob storage for persistence`);
    
    expect(engine.getStats().totalAdapters).toBe(4);
    console.log('\n🎉 Price blob status analysis complete!');
    
  }, 60000); // Extended timeout for multiple API calls
});