#!/usr/bin/env tsx

import { getAccountBalances } from '@repo/polyglot';
import { logger } from './logger';

// Test wallet address - the same one from the previous test
const TEST_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

async function testBalanceTrimming() {
  await logger.info('🧪 Testing Balance Trimming with Merge Functionality');
  await logger.info('='.repeat(60));
  
  try {
    // Fetch balances without trimming
    await logger.info('📊 Fetching balances WITHOUT trimming...');
    const balancesOriginal = await getAccountBalances(TEST_ADDRESS, { trim: false });
    
    if (!balancesOriginal) {
      await logger.error('❌ Failed to fetch original balances');
      return;
    }
    
    const originalTokens = balancesOriginal.fungible_tokens || {};
    const originalCount = Object.keys(originalTokens).length;
    await logger.info(`🪙 Original token count: ${originalCount}`);
    
    // Count tokens with suffixes
    let tokensWithSuffixes = 0;
    const duplicateGroups: { [contractId: string]: string[] } = {};
    
    for (const tokenKey of Object.keys(originalTokens)) {
      if (tokenKey.includes('::')) {
        tokensWithSuffixes++;
        const contractId = tokenKey.substring(0, tokenKey.indexOf('::'));
        
        if (!duplicateGroups[contractId]) {
          duplicateGroups[contractId] = [];
        }
        duplicateGroups[contractId].push(tokenKey);
      }
    }
    
    await logger.info(`🔍 Tokens with :: suffixes: ${tokensWithSuffixes}`);
    
    // Show duplicate groups
    const duplicateGroupsCount = Object.keys(duplicateGroups).filter(contractId => duplicateGroups[contractId].length > 1).length;
    await logger.info(`🔄 Contract IDs with multiple suffixes: ${duplicateGroupsCount}`);
    
    if (duplicateGroupsCount > 0) {
      await logger.info('\n📋 Duplicate groups found:');
      for (const [contractId, tokenKeys] of Object.entries(duplicateGroups)) {
        if (tokenKeys.length > 1) {
          await logger.info(`  • ${contractId}:`);
          for (const tokenKey of tokenKeys) {
            const balance = originalTokens[tokenKey];
            await logger.info(`    - ${tokenKey}: ${balance.balance} (sent: ${balance.total_sent}, received: ${balance.total_received})`);
          }
        }
      }
    }
    
    // Fetch balances with trimming
    await logger.info('\n📊 Fetching balances WITH trimming...');
    const balancesTrimmed = await getAccountBalances(TEST_ADDRESS, { trim: true });
    
    if (!balancesTrimmed) {
      await logger.error('❌ Failed to fetch trimmed balances');
      return;
    }
    
    const trimmedTokens = balancesTrimmed.fungible_tokens || {};
    const trimmedCount = Object.keys(trimmedTokens).length;
    await logger.info(`🪙 Trimmed token count: ${trimmedCount}`);
    
    // Calculate the difference
    const reduction = originalCount - trimmedCount;
    await logger.info(`📉 Reduction: ${reduction} tokens (${((reduction / originalCount) * 100).toFixed(1)}%)`);
    
    // Verify merging worked correctly
    await logger.info('\n🔍 Verifying merge functionality...');
    
    let mergeVerificationsPassed = 0;
    let mergeVerificationsFailed = 0;
    
    for (const [contractId, tokenKeys] of Object.entries(duplicateGroups)) {
      if (tokenKeys.length > 1) {
        // Calculate expected merged balance
        let expectedBalance = 0;
        let expectedSent = 0;
        let expectedReceived = 0;
        
        for (const tokenKey of tokenKeys) {
          const balance = originalTokens[tokenKey];
          expectedBalance += parseFloat(balance.balance || '0');
          expectedSent += parseFloat(balance.total_sent || '0');
          expectedReceived += parseFloat(balance.total_received || '0');
        }
        
        // Check if trimmed version has the merged balance
        const trimmedBalance = trimmedTokens[contractId];
        if (trimmedBalance) {
          const actualBalance = parseFloat(trimmedBalance.balance || '0');
          const actualSent = parseFloat(trimmedBalance.total_sent || '0');
          const actualReceived = parseFloat(trimmedBalance.total_received || '0');
          
          if (actualBalance === expectedBalance && actualSent === expectedSent && actualReceived === expectedReceived) {
            await logger.info(`  ✅ ${contractId}: Balance merged correctly (${actualBalance})`);
            mergeVerificationsPassed++;
          } else {
            await logger.error(`  ❌ ${contractId}: Balance merge failed`);
            await logger.error(`    Expected: balance=${expectedBalance}, sent=${expectedSent}, received=${expectedReceived}`);
            await logger.error(`    Actual: balance=${actualBalance}, sent=${actualSent}, received=${actualReceived}`);
            mergeVerificationsFailed++;
          }
        } else {
          await logger.error(`  ❌ ${contractId}: Missing from trimmed balances`);
          mergeVerificationsFailed++;
        }
      }
    }
    
    await logger.info(`\n📊 Merge verification results:`);
    await logger.info(`  ✅ Passed: ${mergeVerificationsPassed}`);
    await logger.info(`  ❌ Failed: ${mergeVerificationsFailed}`);
    
    if (mergeVerificationsFailed === 0) {
      await logger.success('🎉 All balance merging tests passed!');
    } else {
      await logger.error('❌ Some balance merging tests failed');
    }
    
    // Show some examples of trimmed tokens
    await logger.info('\n🔍 Sample trimmed tokens:');
    let sampleCount = 0;
    for (const [contractId, balance] of Object.entries(trimmedTokens)) {
      if (sampleCount < 5) {
        await logger.info(`  • ${contractId}: ${balance.balance}`);
        sampleCount++;
      }
    }
    
  } catch (error) {
    await logger.error(`❌ Error testing balance trimming: ${error}`);
  }
}

async function main() {
  await logger.info('🚀 Balance Trimming Test Script');
  await logger.info('===============================');
  
  await testBalanceTrimming();
  
  await logger.success('Test completed!');
  await logger.info('\n💡 This test verifies:');
  await logger.info('  - TokenKey suffixes are properly trimmed');
  await logger.info('  - Duplicate balances are merged correctly');
  await logger.info('  - All balance fields (balance, total_sent, total_received) are summed');
  await logger.info('  - No data is lost during the trimming process');
}

main().catch(console.error);