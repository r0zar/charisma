/**
 * Debug script to test portfolio service balance fetching
 */

async function testPortfolioDebug() {
  const userAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
  const charismaPartyUrl = process.env.CHARISMA_PARTY_URL || 'http://localhost:1999';
  
  console.log(`Testing portfolio balance fetching...`);
  console.log(`User: ${userAddress}`);
  console.log(`Charisma Party URL: ${charismaPartyUrl}`);
  
  try {
    const balanceUrl = `${charismaPartyUrl}/parties/balances/main?users=${userAddress}`;
    console.log(`Fetching balances from: ${balanceUrl}`);
    
    const balanceResponse = await fetch(balanceUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`Balance response status: ${balanceResponse.status}`);
    
    if (!balanceResponse.ok) {
      const errorText = await balanceResponse.text();
      console.log(`Balance response error:`, errorText);
      return;
    }

    const balanceData = await balanceResponse.json();
    console.log(`Balance data:`, JSON.stringify(balanceData, null, 2));
    
    const balanceCount = Object.keys(balanceData.balances || {}).length;
    console.log(`Found ${balanceCount} token balances`);
    
    // Now test price fetching
    const priceUrl = `${charismaPartyUrl}/parties/prices/main`;
    console.log(`Fetching prices from: ${priceUrl}`);
    
    const priceResponse = await fetch(priceUrl);
    console.log(`Price response status: ${priceResponse.status}`);
    
    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      console.log(`Price response error:`, errorText);
      return;
    }
    
    const priceData = await priceResponse.json();
    console.log(`Price data count: ${priceData.prices?.length || 0}`);
    
    // Calculate some sample portfolio values
    let totalValue = 0;
    let tokenCount = 0;
    
    for (const [contractId, balance] of Object.entries(balanceData.balances)) {
      const price = priceData.prices?.find((p: any) => p.contractId === contractId)?.price || 0;
      const value = (balance as number) * price;
      
      if (value > 0) {
        totalValue += value;
        tokenCount++;
        console.log(`${contractId}: ${balance} × $${price} = $${value.toFixed(2)}`);
      }
    }
    
    console.log(`\nSummary:`);
    console.log(`Tokens with value: ${tokenCount}`);
    console.log(`Total portfolio value: $${totalValue.toFixed(2)}`);
    
  } catch (error) {
    console.error('Error in portfolio debug:', error);
  }
}

testPortfolioDebug().catch(console.error);