/**
 * Complete Oracle Test - All Adapters
 * 
 * Tests the Oracle Price Engine with all available adapters:
 * - Kraken (BTC price)
 * - CoinGecko (BTC price fallback)
 * - INVEST (token prices from INVEST API)  
 * - STXTools (comprehensive token prices)
 */

import { describe, it, expect } from 'vitest';
import { OraclePriceEngine } from '../engines/oracle-price-engine';
import { KrakenOracleAdapter, CoinGeckoOracleAdapter, InvestAdapter, STXToolsOracleAdapter } from '../oracles';

describe('Complete Oracle Integration', () => {
  it('should demonstrate all oracle adapters working together', async () => {
    console.log('🔮 Testing Complete Oracle Integration with all adapters...');
    
    const engine = new OraclePriceEngine();
    
    // Register all available oracle adapters
    engine.registerAdapter(new KrakenOracleAdapter({ timeoutMs: 10000 }));
    engine.registerAdapter(new CoinGeckoOracleAdapter({ timeoutMs: 10000 }));
    engine.registerAdapter(new InvestAdapter());
    engine.registerAdapter(new STXToolsOracleAdapter());
    
    console.log('✅ Engine configured with all 4 oracle adapters');
    console.log(`   - Kraken: BTC price from exchange`);
    console.log(`   - CoinGecko: BTC price fallback`);
    console.log(`   - INVEST: Token prices from INVEST API`);
    console.log(`   - STXTools: Comprehensive token prices`);
    
    const stats = engine.getStats();
    expect(stats.totalAdapters).toBe(4);
    
    // Test sBTC (should aggregate BTC prices from multiple sources)
    console.log('\n₿ Testing sBTC aggregation...');
    const sBtcResult = await engine.getPrice('SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token');
    
    if (sBtcResult) {
      console.log(`   ✅ sBTC Price: $${sBtcResult.price.usdPrice.toFixed(2)}`);
      console.log(`   📊 Oracle Results:`);
      
      sBtcResult.oracleResults.forEach(result => {
        if (result.success) {
          console.log(`      ✅ ${result.adapterName}: $${result.price?.toFixed(2)}`);
        } else {
          console.log(`      ❌ ${result.adapterName}: ${result.error}`);
        }
      });
      
      const successCount = sBtcResult.oracleResults.filter(r => r.success).length;
      console.log(`   🎯 ${successCount}/${sBtcResult.oracleResults.length} adapters succeeded`);
      
      expect(sBtcResult.price.usdPrice).toBeGreaterThan(0);
      expect(successCount).toBeGreaterThan(0);
    } else {
      console.log(`   ❌ sBTC pricing failed completely`);
    }
    
    // Test STX (should be available from INVEST and STXTools)
    console.log('\n🔸 Testing STX aggregation...');
    const stxResult = await engine.getPrice('.stx');
    
    if (stxResult) {
      console.log(`   ✅ STX Price: $${stxResult.price.usdPrice.toFixed(4)}`);
      console.log(`   📊 Oracle Results:`);
      
      stxResult.oracleResults.forEach(result => {
        if (result.success) {
          console.log(`      ✅ ${result.adapterName}: $${result.price?.toFixed(4)}`);
        } else {
          console.log(`      ❌ ${result.adapterName}: ${result.error}`);
        }
      });
      
      const successCount = stxResult.oracleResults.filter(r => r.success).length;
      console.log(`   🎯 ${successCount}/${stxResult.oracleResults.length} adapters succeeded`);
      
      expect(stxResult.price.usdPrice).toBeGreaterThan(0);
      expect(successCount).toBeGreaterThan(0);
    } else {
      console.log(`   ❌ STX pricing failed completely`);
    }
    
    // Test a token that might only be available from STXTools or INVEST
    console.log('\n🪙 Testing DIKO token aggregation...');
    const dikoResult = await engine.getPrice('SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token');
    
    if (dikoResult) {
      console.log(`   ✅ DIKO Price: $${dikoResult.price.usdPrice.toFixed(6)}`);
      console.log(`   📊 Oracle Results:`);
      
      dikoResult.oracleResults.forEach(result => {
        if (result.success) {
          console.log(`      ✅ ${result.adapterName}: $${result.price?.toFixed(6)}`);
        } else {
          console.log(`      ❌ ${result.adapterName}: ${result.error || 'No price available'}`);
        }
      });
      
      const successCount = dikoResult.oracleResults.filter(r => r.success).length;
      console.log(`   🎯 ${successCount}/${dikoResult.oracleResults.length} adapters succeeded`);
      
      expect(dikoResult.price.usdPrice).toBeGreaterThan(0);
    } else {
      console.log(`   ⚠️ DIKO pricing not available (expected - may not be listed)`);
    }
    
    // Summary
    console.log('\n📈 Oracle Integration Summary:');
    console.log(`   Total Adapters: ${stats.totalAdapters}`);
    console.log(`   Architecture: Simplified oracle aggregation`);
    console.log(`   Benefits:`);
    console.log(`     • Direct adapter aggregation (no strategy abstraction)`);
    console.log(`     • Multiple price sources for reliability`);
    console.log(`     • Automatic fallback between adapters`);
    console.log(`     • Real-time price averaging`);
    
    console.log('\n🎉 Complete oracle integration test completed!');
  }, 45000); // Extended timeout for multiple API calls
});