#!/usr/bin/env node

/**
 * Test Tokens Integration
 * Tests the @repo/tokens getPrices function
 * Usage: node --import tsx scripts/analytics-tests/01-dependencies/test-tokens.ts
 */

import { getPrices } from '@repo/tokens';
import { logger, logExecution, logResult, logError } from '../../logger';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Test tokens with different characteristics
const TEST_TOKENS = {
  native: '.stx',
  charisma: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  alex: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
  velar: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token',
};

async function testBasicFunctionality() {
  console.log('\n🔍 Test 1: Basic Functionality');
  console.log('================================');
  
  const testToken = TEST_TOKENS.native;
  console.log(`Testing token: ${testToken}`);
  
  try {
    const result = await getPrices(testToken);
    
    console.log('✅ Basic call successful');
    console.log(`📊 Result type: ${typeof result}`);
    console.log(`📋 Has prices: ${!!result?.prices}`);
    console.log(`📈 Prices count: ${result?.prices?.length || 0}`);
    console.log(`🕐 Server time: ${result?.serverTime || 'N/A'}`);
    console.log(`🎉 Party: ${result?.party || 'N/A'}`);
    
    if (result?.prices && result.prices.length > 0) {
      console.log('\n💰 Price Data:');
      result.prices.forEach((price: any) => {
        console.log(`   ${price.contractId}: $${price.price?.toFixed(6) || 'N/A'}`);
      });
    }
    
    await logger.success('Tokens basic functionality test passed');
    
    return { success: true, priceCount: result?.prices?.length || 0 };
  } catch (error) {
    console.error('❌ Basic call failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Tokens basic functionality test failed');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testSingleTokens() {
  console.log('\n🔍 Test 2: Individual Tokens');
  console.log('==============================');
  
  const results = [];
  
  for (const [tokenType, tokenId] of Object.entries(TEST_TOKENS)) {
    console.log(`\n📝 Testing: ${tokenType} (${tokenId})`);
    try {
      const result = await getPrices(tokenId);
      const price = result?.prices?.[0]?.price;
      console.log(`✅ ${tokenType} successful - Price: $${price?.toFixed(6) || 'N/A'}`);
      results.push({ 
        tokenType, 
        tokenId, 
        success: true, 
        price: price || 0,
        priceCount: result?.prices?.length || 0
      });
    } catch (error) {
      console.error(`❌ ${tokenType} failed:`, error instanceof Error ? error.message : String(error));
      results.push({ 
        tokenType, 
        tokenId, 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
  
  await logger.info('Tokens individual testing completed', { results });
  return results;
}

async function testMultipleTokens() {
  console.log('\n🔍 Test 3: Multiple Tokens');
  console.log('============================');
  
  const tokenList = Object.values(TEST_TOKENS);
  console.log(`Testing ${tokenList.length} tokens together: [${tokenList.join(', ')}]`);
  
  try {
    const result = await getPrices(tokenList);
    
    console.log('✅ Multiple tokens call successful');
    console.log(`📊 Result type: ${typeof result}`);
    console.log(`📋 Has prices: ${!!result?.prices}`);
    console.log(`📈 Prices count: ${result?.prices?.length || 0}`);
    console.log(`🕐 Server time: ${result?.serverTime || 'N/A'}`);
    
    if (result?.prices && result.prices.length > 0) {
      console.log('\n💰 Price Data:');
      result.prices.forEach((price: any) => {
        console.log(`   ${price.contractId}: $${price.price?.toFixed(6) || 'N/A'}`);
      });
    }
    
    await logger.success('Tokens multiple tokens test passed', {
      tokensRequested: tokenList.length,
      pricesReceived: result?.prices?.length || 0,
      resultType: typeof result,
    });
    
    return { 
      success: true, 
      tokensRequested: tokenList.length,
      pricesReceived: result?.prices?.length || 0 
    };
  } catch (error) {
    console.error('❌ Multiple tokens call failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Tokens multiple tokens test failed', { 
      tokens: tokenList, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testPriceData() {
  console.log('\n🔍 Test 4: Price Data Validation');
  console.log('==================================');
  
  const testToken = TEST_TOKENS.charisma;
  
  try {
    const result = await getPrices(testToken);
    
    if (!result?.prices || result.prices.length === 0) {
      console.log('❌ No price data found for validation');
      return { success: false, error: 'No price data found' };
    }
    
    const price = result.prices[0];
    
    // Validate price data structure
    const validations = {
      hasContractId: !!price.contractId,
      hasPriceValue: typeof price.price === 'number',
      hasTimestamp: !!price.timestamp,
      hasSource: !!price.source,
      priceIsPositive: price.price > 0,
      timestampIsRecent: price.timestamp && (Date.now() - new Date(price.timestamp).getTime()) < 24 * 60 * 60 * 1000, // Within 24 hours
    };
    
    console.log('✅ Price data validation results:');
    Object.entries(validations).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}: ${passed ? 'PASS' : 'FAIL'}`);
    });
    
    console.log('\n📊 Price Data Details:');
    console.log(`   Contract ID: ${price.contractId}`);
    console.log(`   Price: $${price.price?.toFixed(6) || 'N/A'}`);
    console.log(`   Timestamp: ${price.timestamp || 'N/A'}`);
    console.log(`   Source: ${price.source || 'N/A'}`);
    
    const allValidationsPassed = Object.values(validations).every(Boolean);
    
    await logger.info('Tokens price data validation completed', {
      token: testToken,
      validations,
      allPassed: allValidationsPassed,
      priceData: price,
    });
    
    return { 
      success: allValidationsPassed, 
      validations,
      priceData: price
    };
  } catch (error) {
    console.error('❌ Price data validation failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Tokens price data validation failed', { 
      token: testToken, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  try {
    const startTime = Date.now();
    
    await logExecution('Tokens Integration Test', 'Testing @repo/tokens getPrices function');
    
    console.log('🧪 Tokens Integration Test');
    console.log('===========================');
    console.log('Testing @repo/tokens getPrices function\n');
    console.log(`💡 PartyKit URL: ${process.env.PARTYKIT_URL || 'http://localhost:1999'}`);
    
    // Run all tests
    const test1 = await testBasicFunctionality();
    const test2 = await testSingleTokens();
    const test3 = await testMultipleTokens();
    const test4 = await testPriceData();
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`✅ Basic functionality: ${test1.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Single tokens: ${test2.every(r => r.success) ? 'PASS' : 'FAIL'} (${test2.filter(r => r.success).length}/${test2.length})`);
    console.log(`✅ Multiple tokens: ${test3.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Price data validation: ${test4.success ? 'PASS' : 'FAIL'}`);
    
    const allPassed = test1.success && 
                     test2.every(r => r.success) && 
                     test3.success && 
                     test4.success;
    
    const duration = Date.now() - startTime;
    await logResult('Tokens Integration Test', {
      exitCode: allPassed ? 0 : 1,
      stdout: allPassed ? 'All tests passed' : 'Some tests failed',
      summary: {
        basicFunctionality: test1.success,
        singleTokenTests: test2.filter(r => r.success).length + '/' + test2.length,
        multipleTokens: test3.success,
        priceDataValidation: test4.success,
        totalDuration: duration + 'ms',
      }
    }, duration);
    
    if (allPassed) {
      console.log('\n🎉 All Tokens tests PASSED!');
      console.log('✅ @repo/tokens integration is working correctly');
    } else {
      console.log('\n❌ Some Tokens tests FAILED!');
      console.log('🔧 Check the logs for detailed error information');
      process.exit(1);
    }
    
  } catch (error) {
    await logError('Tokens Integration Test failed', error instanceof Error ? error : new Error(String(error)));
    console.error('\n❌ Test script failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  await logError('Tokens Integration Test crashed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});