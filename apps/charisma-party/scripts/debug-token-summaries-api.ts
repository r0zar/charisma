#!/usr/bin/env tsx

/**
 * Debug Script 1: Test token-summaries API endpoint
 * 
 * This script tests the raw API response from /api/token-summaries
 * to ensure we're getting enriched data with price information.
 */

console.log('🔍 DEBUG: Testing token-summaries API endpoint...');
console.log('================================================');

async function testTokenSummariesAPI() {
  // Test different possible endpoints
  const endpoints = [
    process.env.TOKEN_SUMMARIES_URL,
    process.env.NEXT_PUBLIC_TOKEN_SUMMARIES_URL,
    'https://swap.charisma.rocks/api/token-summaries',
    'http://localhost:3000/api/token-summaries'
  ].filter(Boolean);

  for (const endpoint of endpoints) {
    console.log(`\n🔗 Testing endpoint: ${endpoint}`);
    console.log('-'.repeat(50));
    
    try {
      const response = await fetch(endpoint!, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'charisma-party-debug'
        }
      });
      
      console.log(`📊 Response Status: ${response.status}`);
      console.log(`📊 Response Headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`❌ Error Response Body:`, errorText);
        continue;
      }
      
      const data = await response.json();
      console.log(`✅ Response received successfully`);
      console.log(`📈 Data type:`, typeof data);
      console.log(`📈 Data length:`, Array.isArray(data) ? data.length : 'Not an array');
      
      if (Array.isArray(data) && data.length > 0) {
        console.log(`\n🔍 First token sample:`, JSON.stringify(data[0], null, 2));
        
        // Check for price data specifically
        const firstToken = data[0];
        console.log(`\n💰 Price data check for first token:`);
        console.log(`- price: ${firstToken.price} (type: ${typeof firstToken.price})`);
        console.log(`- change1h: ${firstToken.change1h} (type: ${typeof firstToken.change1h})`);
        console.log(`- change24h: ${firstToken.change24h} (type: ${typeof firstToken.change24h})`);
        console.log(`- change7d: ${firstToken.change7d} (type: ${typeof firstToken.change7d})`);
        console.log(`- marketCap: ${firstToken.marketCap} (type: ${typeof firstToken.marketCap})`);
        console.log(`- verified: ${firstToken.verified} (type: ${typeof firstToken.verified})`);
        
        // Count tokens with price data
        const tokensWithPrice = data.filter((token: any) => 
          token.price !== null && token.price !== undefined && typeof token.price === 'number'
        ).length;
        console.log(`\n📊 Summary: ${tokensWithPrice}/${data.length} tokens have price data`);
        
        // Sample a few tokens with price data
        const tokensWithPriceData = data.filter((token: any) => 
          token.price !== null && token.price !== undefined && typeof token.price === 'number'
        ).slice(0, 3);
        
        console.log(`\n🔢 Sample tokens with price data:`);
        tokensWithPriceData.forEach((token: any, index: number) => {
          console.log(`${index + 1}. ${token.symbol} (${token.name})`);
          console.log(`   Price: $${token.price}`);
          console.log(`   24h Change: ${token.change24h}%`);
          console.log(`   Market Cap: $${token.marketCap}`);
        });
        
        return; // Success, exit
      } else {
        console.log(`❌ Data is not a valid array or is empty`);
        console.log(`❌ Full response:`, JSON.stringify(data, null, 2));
      }
      
    } catch (error) {
      console.log(`❌ Fetch error:`, error);
      console.log(`❌ Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }
  
  console.log('\n❌ All endpoints failed or returned invalid data');
}

// Environment info
console.log('🌍 Environment info:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- TOKEN_SUMMARIES_URL:', process.env.TOKEN_SUMMARIES_URL || 'Not set');
console.log('- NEXT_PUBLIC_TOKEN_SUMMARIES_URL:', process.env.NEXT_PUBLIC_TOKEN_SUMMARIES_URL || 'Not set');

testTokenSummariesAPI().catch(console.error);