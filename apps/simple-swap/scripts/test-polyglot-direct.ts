#!/usr/bin/env tsx

import { getAccountBalances } from '@repo/polyglot';
import { logger } from './logger';

const TEST_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

async function testPolyglotDirect() {
  await logger.info('🧪 Testing Polyglot Direct');
  await logger.info('='.repeat(30));
  
  try {
    await logger.info('📊 Testing with trim=false...');
    const balancesFalse = await getAccountBalances(TEST_ADDRESS, { trim: false });
    
    await logger.info('📊 Testing with trim=true...');
    const balancesTrue = await getAccountBalances(TEST_ADDRESS, { trim: true });
    
    if (!balancesFalse || !balancesTrue) {
      await logger.error('❌ Failed to fetch balances');
      return;
    }
    
    const originalCount = Object.keys(balancesFalse.fungible_tokens || {}).length;
    const trimmedCount = Object.keys(balancesTrue.fungible_tokens || {}).length;
    
    await logger.info(`📊 Original count: ${originalCount}`);
    await logger.info(`📊 Trimmed count: ${trimmedCount}`);
    await logger.info(`📊 Difference: ${originalCount - trimmedCount}`);
    
    // Check specific token
    const targetToken = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token';
    const originalBalance = balancesFalse.fungible_tokens?.[targetToken + '::charisma'];
    const trimmedBalance = balancesTrue.fungible_tokens?.[targetToken];
    
    await logger.info(`\n🔍 Original balance (charisma): ${originalBalance?.balance || 'not found'}`);
    await logger.info(`🔍 Trimmed balance: ${trimmedBalance?.balance || 'not found'}`);
    
    if (originalBalance && trimmedBalance) {
      const same = originalBalance.balance === trimmedBalance.balance;
      await logger.info(`🔍 Same balance: ${same ? '✅' : '❌'}`);
      
      if (same) {
        await logger.warn('⚠️  Trimming did not merge balances - only kept first occurrence');
      }
    }
    
  } catch (error) {
    await logger.error(`❌ Error: ${error}`);
  }
}

async function main() {
  await logger.info('🚀 Test Polyglot Direct');
  await logger.info('======================');
  
  await testPolyglotDirect();
  
  await logger.success('Test completed!');
}

main().catch(console.error);