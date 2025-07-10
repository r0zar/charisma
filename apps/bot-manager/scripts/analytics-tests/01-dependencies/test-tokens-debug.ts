#!/usr/bin/env node

/**
 * Debug Tokens Integration
 * Detailed debugging of the @repo/tokens getPrices function
 * Usage: node --import tsx scripts/analytics-tests/01-dependencies/test-tokens-debug.ts
 */

import { getPrices } from '@repo/tokens';
import { logger } from '../../logger';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugTokenRequest(description: string, tokens: string | string[]) {
  console.log(`\n🔍 ${description}`);
  console.log('='.repeat(description.length + 4));
  
  try {
    console.log(`📡 Requesting: ${Array.isArray(tokens) ? tokens.join(', ') : tokens}`);
    
    const result = await getPrices(tokens);
    
    console.log(`✅ Response received:`);
    console.log(`   📊 Result type: ${typeof result}`);
    console.log(`   🎉 Party: ${result.party}`);
    console.log(`   🕐 Server time: ${result.serverTime}`);
    console.log(`   📈 Prices array length: ${result.prices?.length || 0}`);
    
    if (result.prices && result.prices.length > 0) {
      console.log('\n💰 Price Details:');
      result.prices.forEach((price, index) => {
        console.log(`   ${index + 1}. ${price.contractId}:`);
        console.log(`      💵 Price: $${price.price?.toFixed(6) || 'N/A'}`);
        console.log(`      📅 Timestamp: ${new Date(price.timestamp).toISOString()}`);
        console.log(`      🔗 Source: ${price.source || 'N/A'}`);
        console.log(`      📊 Type: ${price.type}`);
      });
    } else {
      console.log('❌ No prices in response');
    }
    
    return { success: true, result };
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testDirectFetch() {
  console.log('\n🔧 Direct Fetch Test');
  console.log('=====================');
  
  const baseUrl = process.env.PARTYKIT_URL || 'http://localhost:1999';
  const testTokens = '.stx,SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
  const url = `${baseUrl}/parties/prices/main?tokens=${encodeURIComponent(testTokens)}`;
  
  console.log(`📡 Direct URL: ${url}`);
  
  try {
    const response = await fetch(url);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Direct fetch successful:`);
      console.log(`   📈 Prices: ${data.prices?.length || 0}`);
      console.log(`   🎉 Party: ${data.party}`);
      console.log(`   🕐 Server time: ${data.serverTime}`);
      
      if (data.prices) {
        data.prices.forEach((price: any) => {
          console.log(`   💰 ${price.contractId}: $${price.price?.toFixed(6)}`);
        });
      }
      
      return { success: true, data };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`❌ Direct fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  try {
    console.log('🧪 Tokens Integration Debug');
    console.log('============================');
    console.log(`💡 PartyKit URL: ${process.env.PARTYKIT_URL || 'http://localhost:1999'}`);
    
    // Test 1: Single token that should work
    await debugTokenRequest('Single STX Token', '.stx');
    
    // Test 2: Single charisma token
    await debugTokenRequest('Single Charisma Token', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token');
    
    // Test 3: Multiple tokens
    await debugTokenRequest('Multiple Tokens', ['.stx', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token']);
    
    // Test 4: Tokens that might not exist
    await debugTokenRequest('Non-existent Token', 'SP999999.fake-token');
    
    // Test 5: Direct fetch comparison
    await testDirectFetch();
    
    // Test 6: Original test tokens
    const originalTokens = [
      '.stx',
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
      'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token',
    ];
    
    await debugTokenRequest('Original Test Tokens', originalTokens);
    
    console.log('\n🎉 Debug testing complete!');
    console.log('Check the results above to identify the issue.');
    
  } catch (error) {
    console.error('\n❌ Debug test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function
main().catch(console.error);