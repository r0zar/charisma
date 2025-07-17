#!/usr/bin/env tsx

import { logger } from './logger';

// Copy the exact functions from polyglot to test them
function extractContractId(tokenKey: string): string {
  const colonIndex = tokenKey.indexOf('::');
  return colonIndex !== -1 ? tokenKey.substring(0, colonIndex) : tokenKey;
}

async function trimTokenKeySuffixes(balances: any): Promise<any> {
  const trimmedBalances: any = {};
  
  await logger.info('🔍 Processing tokens in order:');
  
  for (const [tokenKey, balance] of Object.entries(balances)) {
    const contractId = extractContractId(tokenKey);
    
    await logger.info(`  Processing: ${tokenKey} -> ${contractId}`);
    
    // If we already have a balance for this contract ID, merge the balances
    if (trimmedBalances[contractId]) {
      await logger.info(`    Found existing balance for ${contractId}, merging...`);
      
      const existingBalance = parseFloat(trimmedBalances[contractId].balance || '0');
      const existingTotalSent = parseFloat(trimmedBalances[contractId].total_sent || '0');
      const existingTotalReceived = parseFloat(trimmedBalances[contractId].total_received || '0');
      
      const newBalance = parseFloat((balance as any).balance || '0');
      const newTotalSent = parseFloat((balance as any).total_sent || '0');
      const newTotalReceived = parseFloat((balance as any).total_received || '0');
      
      await logger.info(`    Existing: balance=${existingBalance}, sent=${existingTotalSent}, received=${existingTotalReceived}`);
      await logger.info(`    New: balance=${newBalance}, sent=${newTotalSent}, received=${newTotalReceived}`);
      
      // Merge the balances by summing them
      trimmedBalances[contractId] = {
        balance: (existingBalance + newBalance).toString(),
        total_sent: (existingTotalSent + newTotalSent).toString(),
        total_received: (existingTotalReceived + newTotalReceived).toString()
      };
      
      await logger.info(`    Merged: balance=${existingBalance + newBalance}, sent=${existingTotalSent + newTotalSent}, received=${existingTotalReceived + newTotalReceived}`);
    } else {
      await logger.info(`    First occurrence of ${contractId}, adding directly`);
      trimmedBalances[contractId] = balance;
    }
  }
  
  return trimmedBalances;
}

async function testTrimming() {
  await logger.info('🧪 Testing Trimming Logic');
  await logger.info('='.repeat(40));
  
  // Create test data that matches the real scenario
  const testBalances = {
    'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token::charisma': {
      balance: '1061960684256',
      total_sent: '1142745515400418',
      total_received: '1143807476084674'
    },
    'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token::charisma-locked': {
      balance: '6000104',
      total_sent: '7',
      total_received: '6000111'
    }
  };
  
  await logger.info('📊 Input balances:');
  for (const [tokenKey, balance] of Object.entries(testBalances)) {
    await logger.info(`  ${tokenKey}: ${balance.balance}`);
  }
  
  const result = await trimTokenKeySuffixes(testBalances);
  
  await logger.info('\n📊 Output balances:');
  for (const [contractId, balance] of Object.entries(result)) {
    await logger.info(`  ${contractId}: ${(balance as any).balance}`);
  }
  
  // Check the result
  const contractId = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token';
  const finalBalance = result[contractId];
  
  if (finalBalance) {
    const expectedBalance = 1061960684256 + 6000104;
    const actualBalance = parseFloat(finalBalance.balance);
    
    await logger.info(`\n🔍 Final check:`);
    await logger.info(`  Expected: ${expectedBalance}`);
    await logger.info(`  Actual: ${actualBalance}`);
    await logger.info(`  Match: ${actualBalance === expectedBalance ? '✅' : '❌'}`);
  }
}

async function main() {
  await logger.info('🚀 Test Trimming Logic');
  await logger.info('======================');
  
  await testTrimming();
  
  await logger.success('Test completed!');
}

main().catch(console.error);