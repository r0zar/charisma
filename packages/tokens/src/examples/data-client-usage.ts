/**
 * Data Client Usage Examples
 * 
 * This file demonstrates how to use the data client to fetch
 * balances and prices from the Charisma data API.
 */

import {
  getAddressBalance,
  getAddressBalances,
  getCurrentPrices,
  getTokenPrice,
  getTokenPrices,
  getAddressPortfolio,
  getKnownAddresses,
  getAddressBalanceSeries,
  getTokenPriceSeries,
  getTokenPriceTrends,
  lookupTokenPriceBySymbol,
  type ClientConfig
} from '../data-client';

// Configuration for the client
const config: ClientConfig = {
  timeout: 10000,      // 10 second timeout
  retries: 3,          // Retry failed requests 3 times
  baseUrl: undefined   // Uses discovery module to find API
};

/**
 * Example 1: Get balance for a single address
 */
export async function example1_getSingleBalance() {
  try {
    const address = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
    const balance = await getAddressBalance(address, config);
    
    console.log('Address:', balance.address);
    console.log('STX Balance:', parseInt(balance.stxBalance) / 1000000, 'STX');
    console.log('Token Count:', balance.metadata.tokenCount);
    console.log('NFT Count:', balance.metadata.nftCount);
    
    // Show fungible tokens
    Object.entries(balance.fungibleTokens).forEach(([tokenId, tokenInfo]) => {
      console.log(`Token ${tokenId}: ${tokenInfo.balance} (decimals: ${tokenInfo.decimals || 6})`);
    });
    
    return balance;
  } catch (error) {
    console.error('Failed to get balance:', error);
    throw error;
  }
}

/**
 * Example 2: Get balances for multiple addresses
 */
export async function example2_getMultipleBalances() {
  try {
    const addresses = [
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', // Charisma deployer
      'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM', // Alex deployer
      'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G'  // Welsh deployer
    ];
    
    const balances = await getAddressBalances(addresses, config);
    
    console.log(`Got balances for ${Object.keys(balances).length} addresses:`);
    Object.entries(balances).forEach(([address, balance]) => {
      const stxAmount = parseInt(balance.stxBalance) / 1000000;
      console.log(`${address}: ${stxAmount} STX, ${balance.metadata.tokenCount} tokens`);
    });
    
    return balances;
  } catch (error) {
    console.error('Failed to get multiple balances:', error);
    throw error;
  }
}

/**
 * Example 3: Get current token prices
 */
export async function example3_getCurrentPrices() {
  try {
    const prices = await getCurrentPrices(20, config);
    
    console.log(`Got ${prices.length} current prices:`);
    prices.slice(0, 5).forEach(price => {
      console.log(`${price.symbol} (${price.tokenId}): $${price.usdPrice} (confidence: ${price.confidence})`);
    });
    
    return prices;
  } catch (error) {
    console.error('Failed to get current prices:', error);
    throw error;
  }
}

/**
 * Example 4: Get price for specific tokens
 */
export async function example4_getSpecificTokenPrices() {
  try {
    const tokenIds = [
      '.stx',
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token'
    ];
    
    const prices = await getTokenPrices(tokenIds, config);
    
    console.log('Specific token prices:');
    Object.entries(prices).forEach(([tokenId, price]) => {
      console.log(`${price.symbol}: $${price.usdPrice}`);
    });
    
    return prices;
  } catch (error) {
    console.error('Failed to get specific token prices:', error);
    throw error;
  }
}

/**
 * Example 5: Get comprehensive portfolio for an address
 */
export async function example5_getPortfolio() {
  try {
    const address = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
    const portfolio = await getAddressPortfolio(address, config);
    
    console.log('Portfolio Summary:');
    console.log('STX Value:', `$${portfolio.portfolioValue.stxValue.toFixed(2)}`);
    console.log('Token Value:', `$${portfolio.portfolioValue.tokenValue.toFixed(2)}`);
    console.log('Total Value:', `$${portfolio.portfolioValue.totalValue.toFixed(2)}`);
    
    console.log('\nToken Holdings:');
    Object.entries(portfolio.balance.fungibleTokens).forEach(([tokenId, tokenBalance]) => {
      const price = portfolio.tokenPrices[tokenId];
      if (price) {
        const amount = parseFloat(tokenBalance.balance) / Math.pow(10, tokenBalance.decimals || 6);
        const value = amount * price.usdPrice;
        console.log(`${price.symbol}: ${amount.toFixed(2)} tokens = $${value.toFixed(2)}`);
      }
    });
    
    return portfolio;
  } catch (error) {
    console.error('Failed to get portfolio:', error);
    throw error;
  }
}

/**
 * Example 6: Get historical balance data
 */
export async function example6_getBalanceHistory() {
  try {
    const address = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
    const timeframe = '24h'; // or '7d', '30d', etc.
    
    const balanceSeries = await getAddressBalanceSeries(address, timeframe, config);
    
    console.log(`Balance history for ${address} (${timeframe}):`);
    console.log(`Data points: ${balanceSeries.series.length}`);
    console.log(`Period: ${balanceSeries.metadata.firstDataPoint} to ${balanceSeries.metadata.lastDataPoint}`);
    
    // Show first and last data points
    if (balanceSeries.series.length > 0) {
      const first = balanceSeries.series[0];
      const last = balanceSeries.series[balanceSeries.series.length - 1];
      
      console.log('First point:', {
        timestamp: first.timestamp,
        stxBalance: parseInt(first.stxBalance) / 1000000 + ' STX',
        tokenCount: Object.keys(first.tokenBalances).length
      });
      
      console.log('Last point:', {
        timestamp: last.timestamp,
        stxBalance: parseInt(last.stxBalance) / 1000000 + ' STX',
        tokenCount: Object.keys(last.tokenBalances).length
      });
    }
    
    return balanceSeries;
  } catch (error) {
    console.error('Failed to get balance history:', error);
    throw error;
  }
}

/**
 * Example 7: Get price trends for multiple tokens
 */
export async function example7_getPriceTrends() {
  try {
    const tokenIds = [
      '.stx',
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
    ];
    const timeframe = '24h';
    
    const trends = await getTokenPriceTrends(tokenIds, timeframe, config);
    
    console.log(`Price trends for ${Object.keys(trends).length} tokens (${timeframe}):`);
    Object.entries(trends).forEach(([tokenId, trend]) => {
      console.log(`${trend.symbol}:`, {
        dataPoints: trend.series.length,
        period: `${trend.metadata.firstDataPoint} to ${trend.metadata.lastDataPoint}`
      });
      
      if (trend.series.length > 1) {
        const firstPrice = trend.series[0].value;
        const lastPrice = trend.series[trend.series.length - 1].value;
        const change = ((lastPrice - firstPrice) / firstPrice) * 100;
        console.log(`  Price change: ${change.toFixed(2)}% (${firstPrice} -> ${lastPrice})`);
      }
    });
    
    return trends;
  } catch (error) {
    console.error('Failed to get price trends:', error);
    throw error;
  }
}

/**
 * Example 8: Lookup token by symbol
 */
export async function example8_lookupBySymbol() {
  try {
    const symbol = 'CHA'; // Charisma token
    const price = await lookupTokenPriceBySymbol(symbol, config);
    
    console.log(`Found ${symbol}:`, {
      tokenId: price.tokenId,
      price: `$${price.usdPrice}`,
      confidence: price.confidence
    });
    
    return price;
  } catch (error) {
    console.error('Failed to lookup token by symbol:', error);
    throw error;
  }
}

/**
 * Example 9: Get list of known addresses
 */
export async function example9_getKnownAddresses() {
  try {
    const addresses = await getKnownAddresses(config);
    
    console.log(`Found ${addresses.length} known addresses:`);
    addresses.slice(0, 5).forEach((address, index) => {
      console.log(`${index + 1}. ${address}`);
    });
    
    if (addresses.length > 5) {
      console.log(`... and ${addresses.length - 5} more`);
    }
    
    return addresses;
  } catch (error) {
    console.error('Failed to get known addresses:', error);
    throw error;
  }
}

/**
 * Example 10: Error handling and retries
 */
export async function example10_errorHandling() {
  const configWithShortTimeout: ClientConfig = {
    timeout: 100, // Very short timeout to trigger errors
    retries: 2,
    baseUrl: config.baseUrl
  };
  
  try {
    // This will likely timeout
    await getCurrentPrices(10, configWithShortTimeout);
    console.log('Request succeeded despite short timeout');
  } catch (error) {
    console.log('Request failed as expected:', error instanceof Error ? error.message : error);
  }
  
  // Try with invalid address
  try {
    await getAddressBalance('invalid-address');
  } catch (error) {
    console.log('Invalid address error:', error instanceof Error ? error.message : error);
  }
}

// Run all examples
export async function runAllExamples() {
  const examples = [
    example1_getSingleBalance,
    example2_getMultipleBalances,
    example3_getCurrentPrices,
    example4_getSpecificTokenPrices,
    example5_getPortfolio,
    example6_getBalanceHistory,
    example7_getPriceTrends,
    example8_lookupBySymbol,
    example9_getKnownAddresses,
    example10_errorHandling
  ];
  
  for (const [index, example] of examples.entries()) {
    console.log(`\n--- Example ${index + 1}: ${example.name} ---`);
    try {
      await example();
    } catch (error) {
      console.error(`Example ${index + 1} failed:`, error);
    }
    console.log(''); // Add spacing
  }
}

// Export for use in other files
export {
  config as defaultConfig,
  runAllExamples as runDataClientExamples
};