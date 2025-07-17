#!/usr/bin/env tsx

import { getAccountBalances } from '@repo/polyglot';
import { logger } from './logger';

const TEST_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

async function testSimpleDebug() {
  await logger.info('🧪 Simple Debug Test');
  await logger.info('='.repeat(30));
  
  try {
    console.log('About to call getAccountBalances with trim=true...');
    const result = await getAccountBalances(TEST_ADDRESS, { trim: true });
    console.log('getAccountBalances completed');
    
    if (!result) {
      await logger.error('❌ No result returned');
      return;
    }
    
    const targetToken = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token';
    const balance = result.fungible_tokens?.[targetToken];
    
    if (balance) {
      await logger.info(`📊 Balance found: ${balance.balance}`);
    } else {
      await logger.error('❌ Balance not found');
    }
    
  } catch (error) {
    await logger.error(`❌ Error: ${error}`);
  }
}

async function main() {
  await logger.info('🚀 Simple Debug Test');
  await logger.info('====================');
  
  await testSimpleDebug();
  
  await logger.success('Test completed!');
}

main().catch(console.error);