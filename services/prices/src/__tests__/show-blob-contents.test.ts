/**
 * Show Blob Contents Test
 * 
 * Simple test to display the current price blob contents
 */

import { describe, it } from 'vitest';
import { SimpleBlobStorage } from '../price-series/simple-blob-storage';

describe('Show Blob Contents', () => {
  it('should display current blob storage contents', async () => {
    console.log('📊 CURRENT PRICE BLOB CONTENTS');
    console.log('===============================\n');
    
    const blobStorage = new SimpleBlobStorage();
    
    // Common tokens to check
    const importantTokens = [
      'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
      '.stx',
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token',
      'SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz',
      'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
    ];
    
    let foundCount = 0;
    
    for (const tokenId of importantTokens) {
      try {
        const price = await blobStorage.getCurrentPrice(tokenId);
        
        if (price) {
          foundCount++;
          const symbol = price.tokenId.split('.')[1] || price.tokenId;
          
          console.log(`🪙 ${symbol.toUpperCase()}`);
          console.log(`   Contract: ${price.tokenId}`);
          console.log(`   USD Price: $${price.usdPrice.toFixed(8)}`);
          console.log(`   sBTC Ratio: ${price.sbtcRatio.toFixed(8)}`);
          console.log(`   Source: ${price.source}`);
          console.log(`   Confidence: ${price.confidence || 'N/A'}`);
          console.log(`   Updated: ${new Date(price.timestamp).toISOString()}`);
          console.log(`   Quotes: ${price.quotes.length} data points\n`);
        }
      } catch (error) {
        // Token not found - this is normal
      }
    }
    
    console.log(`📈 SUMMARY: Found ${foundCount} tokens in current blob storage`);
    
    if (foundCount === 0) {
      console.log(`💡 NOTE: No prices found. This likely means:`);
      console.log(`   • This is a fresh setup`);
      console.log(`   • Previous pricing was DEX-based and has been cleared`);
      console.log(`   • New Oracle-based pricing hasn't been generated yet`);
      console.log(`\n🔮 To populate with Oracle data, run the complete-oracle-test`);
    } else {
      console.log(`\n✅ Current blob is populated with Oracle-aggregated prices`);
    }
    
  }, 10000);
});