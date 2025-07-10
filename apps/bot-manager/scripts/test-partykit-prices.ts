#!/usr/bin/env node

/**
 * PartyKit Prices Test Script
 * Tests the getPrices function wrapper for PartyKit price endpoints
 * Usage: node --import tsx scripts/test-partykit-prices.ts [tokens...]
 */

import { getPrices } from '@repo/tokens';
import { logger, logExecution, logResult, logError } from './logger';

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
  await logger.info(`Testing single token request`, { token });
  
  try {
    const result = await getPrices(token);
    console.log(`✅ Success:`, JSON.stringify(result, null, 2));
    await logger.success(`Single token request successful for ${token}`);
    await logger.debug(`Single token response`, { 
      token, 
      priceCount: result.prices.length,
      serverTime: result.serverTime,
      party: result.party 
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error:`, errorMessage);
    await logger.error(`Single token request failed for ${token}`, { token, error: errorMessage });
    return null;
  }
}

async function testMultipleTokens(tokens: string[]) {
  console.log(`\n🔍 Testing multiple tokens: [${tokens.join(', ')}]`);
  await logger.info(`Testing multiple token request`, { tokens, tokenCount: tokens.length });
  
  try {
    const result = await getPrices(tokens);
    console.log(`✅ Success:`, JSON.stringify(result, null, 2));
    await logger.success(`Multiple token request successful for ${tokens.length} tokens`);
    await logger.debug(`Multiple token response`, { 
      tokens, 
      priceCount: result.prices.length,
      serverTime: result.serverTime,
      party: result.party 
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error:`, errorMessage);
    await logger.error(`Multiple token request failed`, { tokens, error: errorMessage });
    return null;
  }
}

async function main() {
  try {
    const startTime = Date.now();
    const tokens = parseArgs();
    
    await logExecution('PartyKit Prices Test', `Testing ${tokens.length} tokens: ${tokens.join(', ')}`);
    
    console.log('🎯 PartyKit Prices Test Script');
    console.log('===============================');
    console.log(`📡 PartyKit URL: ${process.env.PARTYKIT_URL || 'http://localhost:1999'}`);
    console.log(`🪙 Testing tokens: [${tokens.join(', ')}]`);
    
    await logger.info('Starting PartyKit prices test', {
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
    await logResult('PartyKit Prices Test', { 
      exitCode: 0, 
      stdout: 'Test completed successfully',
      summary 
    }, duration);
    
    await logger.success('PartyKit prices test completed successfully');
    
  } catch (error) {
    await logError('PartyKit Prices Test failed', error instanceof Error ? error : new Error(String(error)));
    console.error('\n❌ Test script failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  await logError('PartyKit Prices Test failed', error instanceof Error ? error : new Error(String(error)));
  console.error('\n❌ Test script failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});