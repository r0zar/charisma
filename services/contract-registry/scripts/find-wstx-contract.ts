#!/usr/bin/env tsx

/**
 * Find wSTX Contract - Look for wrapped STX tokens in the cache
 */

import { listTokens } from '@repo/tokens';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function findWstxContract() {
  console.log('🔍 SEARCHING FOR WSTX CONTRACTS');
  console.log('='.repeat(50));

  try {
    const tokens = await listTokens();
    
    // Search for wSTX related tokens
    const wstxCandidates = tokens.filter(token => 
      token.contractId.toLowerCase().includes('wstx') ||
      token.name.toLowerCase().includes('wrapped stx') ||
      token.name.toLowerCase().includes('wstx') ||
      token.symbol.toLowerCase().includes('wstx')
    );

    console.log(`📊 Found ${wstxCandidates.length} potential wSTX contracts:`);
    
    wstxCandidates.forEach((token, index) => {
      console.log(`\n${index + 1}. ${token.contractId}`);
      console.log(`   Name: ${token.name}`);
      console.log(`   Symbol: ${token.symbol}`);
      console.log(`   Decimals: ${token.decimals ?? 'N/A'}`);
      console.log(`   Last Updated: ${token.lastUpdated ? new Date(token.lastUpdated).toISOString() : 'N/A'}`);
    });

    // Also search more broadly for STX-related tokens
    const stxTokens = tokens.filter(token => 
      (token.symbol.toLowerCase() === 'stx' || 
       token.symbol.toLowerCase() === 'wstx' ||
       token.name.toLowerCase().includes('stx') ||
       token.contractId.toLowerCase().includes('stx')) &&
      !token.contractId.includes('stxcity') // Filter out stxcity meme tokens
    );

    console.log(`\n\n📊 Found ${stxTokens.length} STX-related contracts (excluding stxcity):`);
    
    stxTokens.slice(0, 10).forEach((token, index) => {
      console.log(`\n${index + 1}. ${token.contractId}`);
      console.log(`   Name: ${token.name}`);
      console.log(`   Symbol: ${token.symbol}`);
    });

    return { wstxCandidates, stxTokens };

  } catch (error) {
    console.error('❌ Error searching for wSTX contracts:', error);
    throw error;
  }
}

// Run the search
findWstxContract().then((result) => {
  console.log('\n📊 SEARCH RESULTS:');
  console.log(`   wSTX candidates: ${result.wstxCandidates.length}`);
  console.log(`   STX-related: ${result.stxTokens.length}`);

  if (result.wstxCandidates.length > 0) {
    console.log('\n✅ Found potential wSTX contracts to test');
  } else {
    console.log('\n⚠️  No obvious wSTX contracts found in token cache');
    console.log('   The contract SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx may not be in the cache');
  }

  console.log('\n✅ wSTX search completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ wSTX search failed:', error);
  process.exit(1);
});