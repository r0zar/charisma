import { PriceSeriesAPI, PriceSeriesStorage } from '@services/prices';

async function testSBTC() {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN || 'dummy';
  console.log('Blob token available:', !!blobToken && blobToken !== 'dummy');
  
  if (!blobToken || blobToken === 'dummy') {
    console.log('No blob token - cannot test');
    return;
  }
  
  try {
    const storage = new PriceSeriesStorage(blobToken);
    const priceAPI = new PriceSeriesAPI(storage);
    
    // Get all available tokens first
    console.log('Getting all available tokens...');
    const allTokens = await priceAPI.getAllTokens();
    if (allTokens.success && allTokens.data) {
      console.log('Total tokens available:', allTokens.data.length);
      
      // Search for sBTC-related tokens
      const sbtcTokens = allTokens.data.filter(token => 
        token.tokenId.toLowerCase().includes('sbtc') || 
        token.tokenId.toLowerCase().includes('btc')
      );
      
      console.log('\\nsBTC/BTC related tokens found:');
      sbtcTokens.forEach(token => {
        console.log(`- ${token.tokenId} (price: ${token.usdPrice})`);
      });
      
      if (sbtcTokens.length > 0) {
        const realSBTC = sbtcTokens[0];
        console.log(`\\nTesting real sBTC token: ${realSBTC.tokenId}`);
        
        const histResult = await priceAPI.getPriceHistory({
          tokenId: realSBTC.tokenId,
          timeframe: '1h',
          limit: 5
        });
        console.log('Real sBTC history result:', JSON.stringify(histResult, null, 2));
      }
    } else {
      console.log('Failed to get all tokens:', allTokens.error);
    }
    
  } catch (error) {
    console.error('Error testing sBTC:', error.message);
    console.error('Full error:', error);
  }
}

testSBTC().catch(console.error);