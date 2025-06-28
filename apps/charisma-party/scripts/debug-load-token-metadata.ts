#!/usr/bin/env tsx

/**
 * Debug Script 2: Test loadTokenMetadata function
 * 
 * This script tests the loadTokenMetadata function from balances-lib
 * to see how the token-summaries API data is being processed.
 */

import { loadTokenMetadata } from '../src/balances-lib.js';

console.log('🔍 DEBUG: Testing loadTokenMetadata function...');
console.log('=================================================');

async function testLoadTokenMetadata() {
  try {
    console.log('🏷️ Calling loadTokenMetadata()...');
    const startTime = Date.now();
    
    const tokenRecords = await loadTokenMetadata();
    
    const endTime = Date.now();
    console.log(`⏱️  Function completed in ${endTime - startTime}ms`);
    
    console.log(`\n📊 Results Summary:`);
    console.log(`- Type: ${typeof tokenRecords}`);
    console.log(`- Size: ${tokenRecords.size}`);
    console.log(`- Constructor: ${tokenRecords.constructor.name}`);
    
    if (tokenRecords.size === 0) {
      console.log('❌ No token records loaded!');
      return;
    }
    
    // Get first few records to inspect
    const entries = Array.from(tokenRecords.entries()).slice(0, 3);
    
    console.log(`\n🔍 First ${entries.length} token records:`);
    entries.forEach(([contractId, record], index) => {
      console.log(`\n${index + 1}. Contract ID: ${contractId}`);
      console.log(`   Full Record:`, JSON.stringify(record, null, 2));
      
      // Check specific fields we care about
      console.log(`\n   🔍 Field Analysis:`);
      console.log(`   - name: "${record.name}" (${typeof record.name})`);
      console.log(`   - symbol: "${record.symbol}" (${typeof record.symbol})`);
      console.log(`   - type: "${record.type}" (${typeof record.type})`);
      console.log(`   - price: ${record.price} (${typeof record.price})`);
      console.log(`   - change24h: ${record.change24h} (${typeof record.change24h})`);
      console.log(`   - change7d: ${record.change7d} (${typeof record.change7d})`);
      console.log(`   - marketCap: ${record.marketCap} (${typeof record.marketCap})`);
      console.log(`   - verified: ${record.verified} (${typeof record.verified})`);
      console.log(`   - metadataSource: "${record.metadataSource}"`);
    });
    
    // Count tokens by type
    const typeStats = new Map<string, number>();
    const priceStats = {
      withPrice: 0,
      withoutPrice: 0,
      withChange24h: 0,
      withMarketCap: 0
    };
    
    tokenRecords.forEach((record) => {
      // Type counting
      const type = record.type || 'unknown';
      typeStats.set(type, (typeStats.get(type) || 0) + 1);
      
      // Price data counting
      if (record.price !== null && record.price !== undefined && typeof record.price === 'number') {
        priceStats.withPrice++;
      } else {
        priceStats.withoutPrice++;
      }
      
      if (record.change24h !== null && record.change24h !== undefined && typeof record.change24h === 'number') {
        priceStats.withChange24h++;
      }
      
      if (record.marketCap !== null && record.marketCap !== undefined && typeof record.marketCap === 'number') {
        priceStats.withMarketCap++;
      }
    });
    
    console.log(`\n📈 Token Type Distribution:`);
    typeStats.forEach((count, type) => {
      console.log(`   - ${type}: ${count} tokens`);
    });
    
    console.log(`\n💰 Price Data Statistics:`);
    console.log(`   - Tokens with price: ${priceStats.withPrice}/${tokenRecords.size}`);
    console.log(`   - Tokens without price: ${priceStats.withoutPrice}/${tokenRecords.size}`);
    console.log(`   - Tokens with 24h change: ${priceStats.withChange24h}/${tokenRecords.size}`);
    console.log(`   - Tokens with market cap: ${priceStats.withMarketCap}/${tokenRecords.size}`);
    
    // Sample tokens with price data
    const tokensWithPrice = Array.from(tokenRecords.values()).filter(record => 
      record.price !== null && record.price !== undefined && typeof record.price === 'number'
    ).slice(0, 5);
    
    if (tokensWithPrice.length > 0) {
      console.log(`\n🔢 Sample tokens WITH price data:`);
      tokensWithPrice.forEach((record, index) => {
        console.log(`${index + 1}. ${record.symbol} (${record.name})`);
        console.log(`   Contract: ${record.contractId}`);
        console.log(`   Price: $${record.price}`);
        console.log(`   24h Change: ${record.change24h}%`);
        console.log(`   Market Cap: $${record.marketCap}`);
        console.log(`   Source: ${record.metadataSource}`);
      });
    }
    
    // Sample tokens without price data
    const tokensWithoutPrice = Array.from(tokenRecords.values()).filter(record => 
      record.price === null || record.price === undefined || typeof record.price !== 'number'
    ).slice(0, 3);
    
    if (tokensWithoutPrice.length > 0) {
      console.log(`\n❌ Sample tokens WITHOUT price data:`);
      tokensWithoutPrice.forEach((record, index) => {
        console.log(`${index + 1}. ${record.symbol} (${record.name})`);
        console.log(`   Contract: ${record.contractId}`);
        console.log(`   Price: ${record.price} (${typeof record.price})`);
        console.log(`   Source: ${record.metadataSource}`);
      });
    }
    
    console.log(`\n✅ loadTokenMetadata test completed successfully!`);
    
  } catch (error) {
    console.log(`❌ Error in loadTokenMetadata:`, error);
    console.log(`❌ Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
  }
}

// Environment info
console.log('🌍 Environment info:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- Current working directory:', process.cwd());

testLoadTokenMetadata().catch(console.error);