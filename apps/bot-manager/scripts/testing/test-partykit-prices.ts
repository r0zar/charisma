#!/usr/bin/env node

/**
 * PartyKit Prices Test Script
 * Tests the getPrices function wrapper for PartyKit price endpoints
 * Usage: node --import tsx scripts/test-partykit-prices.ts [tokens...]
 */

import { getPrices } from '@repo/tokens';
import { syncLogger as logger } from '../utils/logger';

// Test tokens
const DEFAULT_TOKENS = [
  '.stx',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
];

function parseArgs(): string[] {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    return DEFAULT_TOKENS;
  }
  
  if (args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }
  
  return args;
}

function showHelp() {
  console.log(`
🎯 PartyKit Prices Test Script
==============================

Tests the getPrices function wrapper for PartyKit price endpoints.

Usage:
  node --import tsx scripts/test-partykit-prices.ts [tokens...]

Arguments:
  tokens...            Contract IDs to fetch prices for (optional)

Examples:
  node --import tsx scripts/test-partykit-prices.ts
  node --import tsx scripts/test-partykit-prices.ts .stx
  node --import tsx scripts/test-partykit-prices.ts .stx SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token

Default tokens:
  - .stx (native STX token)
  - SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token (CHARISMA token)

Environment Variables:
  PARTYKIT_URL         Base URL for PartyKit service (default: http://localhost:1999)
`);
}

async function testSingleToken(token: string) {
  console.log(`\n🔍 Testing single token: ${token}`);
  logger.info(`Testing single token request: ${token}`);
  
  try {
    const result = await getPrices(token);
    console.log(`✅ Success:`, JSON.stringify(result, null, 2));
    logger.success(`Single token request successful for ${token}`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error:`, errorMessage);
    logger.error(`Single token request failed for ${token}: ${errorMessage}`);
    return null;
  }
}

async function testMultipleTokens(tokens: string[]) {
  console.log(`\n🔍 Testing multiple tokens: [${tokens.join(', ')}]`);
  logger.info(`Testing multiple token request: ${tokens.length} tokens`);
  
  try {
    const result = await getPrices(tokens);
    console.log(`✅ Success:`, JSON.stringify(result, null, 2));
    logger.success(`Multiple token request successful for ${tokens.length} tokens`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error:`, errorMessage);
    logger.error(`Multiple token request failed: ${errorMessage}`);
    return null;
  }
}

async function main() {
  try {
    const startTime = Date.now();
    const tokens = parseArgs();
    
    logger.info(`🚀 Starting PartyKit Prices Test: Testing ${tokens.length} tokens: ${tokens.join(', ')}`);
    
    console.log('🎯 PartyKit Prices Test Script');
    console.log('===============================');
    console.log(`📡 PartyKit URL: ${process.env.PARTYKIT_URL || 'http://localhost:1999'}`);
    console.log(`🪙 Testing tokens: [${tokens.join(', ')}]`);
    
    logger.info('Starting PartyKit prices test', {
      tokensToTest: tokens,
      tokenCount: tokens.length,
      partykitUrl: process.env.PARTYKIT_URL || 'http://localhost:1999'
    });
    
    // Test individual tokens
    const singleResults = [];
    for (const token of tokens) {
      const result = await testSingleToken(token);
      if (result) singleResults.push(result);
    }
    
    // Test all tokens together
    let multiResult = null;
    if (tokens.length > 1) {
      multiResult = await testMultipleTokens(tokens);
    }
    
    // Summary
    const totalPriceUpdates = singleResults.reduce((sum, result) => sum + result.prices.length, 0);
    const summary = {
      tokensRequested: tokens.length,
      successfulSingleRequests: singleResults.length,
      totalPriceUpdatesReceived: totalPriceUpdates,
      multiTokenTestSuccessful: multiResult !== null,
      priceData: singleResults.flatMap(result => 
        result.prices.map(price => ({
          contractId: price.contractId,
          price: price.price,
          timestamp: price.timestamp,
          source: price.source
        }))
      )
    };
    
    console.log('\n📊 Test Summary:');
    console.log(`   • Tokens tested: ${summary.tokensRequested}`);
    console.log(`   • Successful single requests: ${summary.successfulSingleRequests}`);
    console.log(`   • Total price updates received: ${summary.totalPriceUpdatesReceived}`);
    
    if (singleResults.length > 0) {
      console.log('\n💰 Price Data Sample:');
      singleResults.forEach(result => {
        result.prices.forEach(price => {
          console.log(`   ${price.contractId}: $${price.price.toFixed(6)} (${new Date(price.timestamp).toISOString()})`);
        });
      });
    }
    
    console.log('\n✅ Test completed!');
    
    const duration = Date.now() - startTime;
    logger.success('PartyKit prices test completed', {
      duration: `${duration}ms`,
      summary: {
        tokensRequested: summary.tokensRequested,
        successfulSingleRequests: summary.successfulSingleRequests,
        totalPriceUpdatesReceived: summary.totalPriceUpdatesReceived,
        multiTokenTestSuccessful: summary.multiTokenTestSuccessful,
        averageResponseTime: `${Math.round(duration / (summary.successfulSingleRequests || 1))}ms`
      },
      priceDataSample: summary.priceData.slice(0, 3) // First 3 results for logging
    });
    
  } catch (error) {
    logger.error(`PartyKit Prices Test failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error('\n❌ Test script failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  logger.error(`PartyKit Prices Test failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error('\n❌ Test script failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});