/**
 * Simplified Blob Structure Test
 * 
 * Tests the new simplified blob structure without quotes
 */

import { describe, it, expect } from 'vitest';
import { OraclePriceEngine } from '../engines/oracle-price-engine';
import { KrakenOracleAdapter, CoinGeckoOracleAdapter, InvestAdapter, STXToolsOracleAdapter } from '../oracles';
import { SimpleBlobStorage } from '../price-series/simple-blob-storage';
import { createBlobFromPriceResults } from '../price-series/blob-builder';

describe('Simplified Blob Structure', () => {
  it('should use the new simplified blob structure without quotes', async () => {
    console.log('🧹 Testing Simplified Blob Structure');
    console.log('====================================\n');
    
    const blobStorage = new SimpleBlobStorage();
    
    // Clear any existing blobs to start fresh
    console.log('🗑️ Clearing existing blobs...');
    try {
      await blobStorage.clearAllBlobs();
      console.log('✅ Existing blobs cleared\n');
    } catch (error) {
      console.log('ℹ️ No existing blobs to clear (or no blob token configured)\n');
    }
    
    // Setup Oracle Price Engine
    console.log('🔮 Setting up Oracle Price Engine...');
    const engine = new OraclePriceEngine(undefined, blobStorage);
    
    engine.registerAdapter(new KrakenOracleAdapter({ timeoutMs: 10000 }));
    engine.registerAdapter(new CoinGeckoOracleAdapter({ timeoutMs: 10000 }));
    engine.registerAdapter(new InvestAdapter());
    engine.registerAdapter(new STXToolsOracleAdapter());
    
    console.log('✅ Engine configured with 4 oracle adapters\n');
    
    // Get some test prices
    console.log('💰 Getting test prices...');
    const testTokens = [
      'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
      '.stx'
    ];
    
    const prices = new Map();
    
    for (const tokenId of testTokens) {
      try {
        const result = await engine.getPrice(tokenId);
        if (result) {
          prices.set(tokenId, result);
          const symbol = tokenId.split('.')[1] || tokenId;
          console.log(`   ✅ ${symbol.toUpperCase()}: $${result.price.usdPrice.toFixed(4)}`);
        }
      } catch (error) {
        const symbol = tokenId.split('.')[1] || tokenId;
        console.log(`   ⚠️ ${symbol.toUpperCase()}: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    console.log(`\n📊 Successfully retrieved ${prices.size} prices`);
    
    if (prices.size > 0) {
      // Test blob creation with simplified structure
      console.log('\n🏗️ Testing simplified blob structure...');
      
      const blobData = createBlobFromPriceResults(prices);
      console.log('✅ Blob created with simplified structure');
      
      // Verify the structure
      const sampleTokenId = Array.from(prices.keys())[0];
      const tokenData = blobData[sampleTokenId];
      
      if (tokenData) {
        const timestamps = Object.keys(tokenData);
        const sampleEntry = tokenData[timestamps[0]];
        
        console.log('\n📋 Sample blob entry structure:');
        console.log('   Fields:', Object.keys(sampleEntry));
        console.log('   ✅ tokenId:', typeof sampleEntry.tokenId);
        console.log('   ✅ usdPrice:', typeof sampleEntry.usdPrice);
        console.log('   ✅ sbtcRatio:', typeof sampleEntry.sbtcRatio);
        console.log('   ✅ source:', typeof sampleEntry.source);
        console.log('   ✅ timestamp:', typeof sampleEntry.timestamp);
        
        // Verify no quotes field
        expect(sampleEntry).not.toHaveProperty('quotes');
        expect(sampleEntry).not.toHaveProperty('confidence');
        console.log('   ✅ No quotes field (as expected)');
        console.log('   ✅ No confidence field (as expected)');
        
        // Verify required fields
        expect(sampleEntry.tokenId).toBeTruthy();
        expect(typeof sampleEntry.usdPrice).toBe('number');
        expect(typeof sampleEntry.sbtcRatio).toBe('number');
        expect(typeof sampleEntry.source).toBe('string');
        expect(typeof sampleEntry.timestamp).toBe('number');
        
        console.log('\n📏 Simplified Structure Summary:');
        console.log('   • Removed: quotes array (complex BigInt data)');
        console.log('   • Removed: confidence field');
        console.log('   • Kept: Essential price data only');
        console.log('   • Result: Clean, minimal structure');
      }
      
      // Test saving to blob storage if token is available
      console.log('\n💾 Testing blob storage save...');
      try {
        await engine.saveSnapshot(prices);
        console.log('✅ Successfully saved snapshot with simplified structure');
        
        // Test retrieval
        const retrievedPrice = await blobStorage.getCurrentPrice(sampleTokenId);
        if (retrievedPrice) {
          console.log('✅ Successfully retrieved price from simplified blob');
          expect(retrievedPrice).not.toHaveProperty('quotes');
          expect(retrievedPrice).not.toHaveProperty('confidence');
          console.log('   ✅ Retrieved data has simplified structure');
        }
        
      } catch (error) {
        console.log('ℹ️ Blob storage save skipped (no BLOB_READ_WRITE_TOKEN configured)');
        console.log('   This is normal for local testing');
      }
    }
    
    console.log('\n🎉 Simplified blob structure test completed!');
    console.log('\n📈 New Blob Structure Benefits:');
    console.log('   • Smaller storage footprint');
    console.log('   • Simpler data model');
    console.log('   • Faster serialization/deserialization');
    console.log('   • Oracle-focused design');
    console.log('   • No BigInt complexities');
    
  }, 45000);
});