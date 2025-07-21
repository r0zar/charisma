#!/usr/bin/env tsx

/**
 * Check Token Cache Status - Inspect what tokens exist in @repo/tokens cache
 */

import { listTokens } from '@repo/tokens';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Test contracts to specifically look for
const TEST_CONTRACTS = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx',
  'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope'
];

async function checkTokenCacheStatus() {
  console.log('🔍 CHECKING TOKEN CACHE STATUS');
  console.log('='.repeat(50));

  try {
    const tokens = await listTokens();
    console.log(`📊 Found ${tokens.length} tokens in @repo/tokens cache\n`);

    // Check if our test contracts exist in the cache
    console.log('🪙 CHECKING TEST CONTRACTS IN CACHE:');
    for (const testContract of TEST_CONTRACTS) {
      const token = tokens.find(t => t.contractId === testContract);
      if (token) {
        console.log(`✅ ${testContract}`);
        console.log(`   Name: ${token.name}`);
        console.log(`   Symbol: ${token.symbol}`);
        console.log(`   Decimals: ${token.decimals ?? 'N/A'}`);
        console.log(`   Last Updated: ${token.lastUpdated ? new Date(token.lastUpdated).toISOString() : 'N/A'}`);
      } else {
        console.log(`❌ ${testContract} - NOT FOUND in token cache`);
      }
      console.log('');
    }

    // Show a sample of tokens from the cache
    console.log('📋 SAMPLE TOKENS FROM CACHE (first 10):');
    for (let i = 0; i < Math.min(10, tokens.length); i++) {
      const token = tokens[i];
      console.log(`${i+1}. ${token.contractId}`);
      console.log(`   Name: ${token.name}`);
      console.log(`   Symbol: ${token.symbol}`);
      console.log(`   Type: ${token.type}`);
      console.log('');
    }

    // Look for common patterns
    console.log('🔍 CACHE ANALYSIS:');
    const contractIds = tokens.map(t => t.contractId);
    const uniqueContractIds = new Set(contractIds);
    
    console.log(`📊 Total tokens: ${tokens.length}`);
    console.log(`📊 Unique contract IDs: ${uniqueContractIds.size}`);
    
    if (tokens.length !== uniqueContractIds.size) {
      console.log(`⚠️  Found ${tokens.length - uniqueContractIds.size} duplicate contract IDs`);
    }

    // Check for specific patterns we know should exist
    const charismaTokens = tokens.filter(t => t.contractId.includes('charisma'));
    const stxTokens = tokens.filter(t => t.contractId.includes('stx') || t.symbol?.toLowerCase().includes('stx'));
    const nopeTokens = tokens.filter(t => t.contractId.includes('nope') || t.symbol?.toLowerCase() === 'not');

    console.log(`\n📈 Pattern Analysis:`);
    console.log(`   Charisma-related: ${charismaTokens.length}`);
    console.log(`   STX-related: ${stxTokens.length}`);
    console.log(`   NOPE-related: ${nopeTokens.length}`);

    if (charismaTokens.length > 0) {
      console.log('\n🔍 Charisma tokens found:');
      charismaTokens.slice(0, 3).forEach(token => {
        console.log(`   - ${token.contractId}: ${token.name} (${token.symbol})`);
      });
    }

    if (stxTokens.length > 0) {
      console.log('\n🔍 STX-related tokens found:');
      stxTokens.slice(0, 3).forEach(token => {
        console.log(`   - ${token.contractId}: ${token.name} (${token.symbol})`);
      });
    }

    return { tokens, testResults: TEST_CONTRACTS.map(contractId => ({
      contractId,
      inCache: tokens.some(t => t.contractId === contractId)
    }))};

  } catch (error) {
    console.error('❌ Error checking token cache:', error);
    throw error;
  }
}

// Run the check
checkTokenCacheStatus().then((result) => {
  console.log('\n📊 SUMMARY:');
  result.testResults.forEach(({ contractId, inCache }) => {
    console.log(`   ${inCache ? '✅' : '❌'} ${contractId}`);
  });

  const foundCount = result.testResults.filter(r => r.inCache).length;
  console.log(`\n📈 Test contracts in cache: ${foundCount}/${result.testResults.length}`);

  console.log('\n✅ Token cache status check completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Token cache check failed:', error);
  process.exit(1);
});