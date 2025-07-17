#!/usr/bin/env tsx

import { getAccountBalances } from '@repo/polyglot';
import { logger } from './logger';

const TEST_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

async function debugBalanceTrimming() {
  await logger.info('🐛 Debug Balance Trimming');
  await logger.info('='.repeat(40));
  
  try {
    // Fetch balances without trimming
    const balancesOriginal = await getAccountBalances(TEST_ADDRESS, { trim: false });
    
    if (!balancesOriginal) {
      await logger.error('❌ Failed to fetch original balances');
      return;
    }
    
    const originalTokens = balancesOriginal.fungible_tokens || {};
    
    // Focus on the problematic token
    const problemToken = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token';
    const relatedTokens = Object.keys(originalTokens).filter(key => key.startsWith(problemToken));
    
    await logger.info(`🔍 Found ${relatedTokens.length} related tokens:`);
    for (const tokenKey of relatedTokens) {
      const balance = originalTokens[tokenKey];
      await logger.info(`  • ${tokenKey}`);
      await logger.info(`    balance: ${balance.balance}`);
      await logger.info(`    total_sent: ${balance.total_sent}`);
      await logger.info(`    total_received: ${balance.total_received}`);
    }
    
    // Calculate expected merged values
    let expectedBalance = 0;
    let expectedSent = 0;
    let expectedReceived = 0;
    
    for (const tokenKey of relatedTokens) {
      const balance = originalTokens[tokenKey];
      expectedBalance += parseFloat(balance.balance || '0');
      expectedSent += parseFloat(balance.total_sent || '0');
      expectedReceived += parseFloat(balance.total_received || '0');
    }
    
    await logger.info(`\n📊 Expected merged values:`);
    await logger.info(`  balance: ${expectedBalance}`);
    await logger.info(`  total_sent: ${expectedSent}`);
    await logger.info(`  total_received: ${expectedReceived}`);
    
    // Test with trimming
    const balancesTrimmed = await getAccountBalances(TEST_ADDRESS, { trim: true });
    
    if (!balancesTrimmed) {
      await logger.error('❌ Failed to fetch trimmed balances');
      return;
    }
    
    const trimmedTokens = balancesTrimmed.fungible_tokens || {};
    const trimmedBalance = trimmedTokens[problemToken];
    
    if (trimmedBalance) {
      await logger.info(`\n📊 Actual trimmed values:`);
      await logger.info(`  balance: ${trimmedBalance.balance}`);
      await logger.info(`  total_sent: ${trimmedBalance.total_sent}`);
      await logger.info(`  total_received: ${trimmedBalance.total_received}`);
      
      const actualBalance = parseFloat(trimmedBalance.balance || '0');
      const actualSent = parseFloat(trimmedBalance.total_sent || '0');
      const actualReceived = parseFloat(trimmedBalance.total_received || '0');
      
      await logger.info(`\n🔍 Comparison:`);
      await logger.info(`  balance: ${actualBalance === expectedBalance ? '✅' : '❌'} (${actualBalance} vs ${expectedBalance})`);
      await logger.info(`  total_sent: ${actualSent === expectedSent ? '✅' : '❌'} (${actualSent} vs ${expectedSent})`);
      await logger.info(`  total_received: ${actualReceived === expectedReceived ? '✅' : '❌'} (${actualReceived} vs ${expectedReceived})`);
    } else {
      await logger.error(`❌ Token ${problemToken} not found in trimmed balances`);
    }
    
  } catch (error) {
    await logger.error(`❌ Error debugging balance trimming: ${error}`);
  }
}

async function main() {
  await logger.info('🚀 Debug Balance Trimming');
  await logger.info('========================');
  
  await debugBalanceTrimming();
  
  await logger.success('Debug completed!');
}

main().catch(console.error);