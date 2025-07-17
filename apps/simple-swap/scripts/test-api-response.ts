#!/usr/bin/env tsx

import { getAccountBalances } from '@repo/polyglot';
import { logger } from './logger';

const TEST_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

async function testApiResponse() {
  await logger.info('🧪 Testing API Response Processing');
  await logger.info('='.repeat(40));
  
  try {
    // Get the raw response
    const rawResponse = await getAccountBalances(TEST_ADDRESS, { trim: false });
    
    if (!rawResponse) {
      await logger.error('❌ Failed to fetch balances');
      return;
    }
    
    const fungibleTokens = rawResponse.fungible_tokens || {};
    
    // Find the problematic tokens
    const targetContractId = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token';
    const relatedTokens = Object.keys(fungibleTokens).filter(key => key.startsWith(targetContractId));
    
    await logger.info(`🔍 Found ${relatedTokens.length} related tokens:`);
    
    // Show exact order as returned by the API
    const allTokens = Object.keys(fungibleTokens);
    const relatedIndices = relatedTokens.map(token => allTokens.indexOf(token));
    
    await logger.info(`📊 Token positions in API response: ${relatedIndices.join(', ')}`);
    
    for (let i = 0; i < relatedTokens.length; i++) {
      const tokenKey = relatedTokens[i];
      const balance = fungibleTokens[tokenKey];
      await logger.info(`  ${i + 1}. ${tokenKey} (position ${relatedIndices[i]})`);
      await logger.info(`     balance: ${balance.balance}`);
      await logger.info(`     total_sent: ${balance.total_sent}`);
      await logger.info(`     total_received: ${balance.total_received}`);
    }
    
    // Now test the trimming function manually
    await logger.info('\n🔧 Manual trimming test:');
    
    // Create a simplified test case with just these two tokens
    const testTokens: any = {};
    for (const tokenKey of relatedTokens) {
      testTokens[tokenKey] = fungibleTokens[tokenKey];
    }
    
    // Apply the trimming logic
    const trimmedTokens: any = {};
    
    for (const [tokenKey, balance] of Object.entries(testTokens)) {
      const contractId = tokenKey.indexOf('::') !== -1 ? tokenKey.substring(0, tokenKey.indexOf('::')) : tokenKey;
      
      await logger.info(`  Processing: ${tokenKey} -> ${contractId}`);
      
      if (trimmedTokens[contractId]) {
        await logger.info(`    Merging with existing balance...`);
        
        const existingBalance = parseFloat(trimmedTokens[contractId].balance || '0');
        const existingTotalSent = parseFloat(trimmedTokens[contractId].total_sent || '0');
        const existingTotalReceived = parseFloat(trimmedTokens[contractId].total_received || '0');
        
        const newBalance = parseFloat((balance as any).balance || '0');
        const newTotalSent = parseFloat((balance as any).total_sent || '0');
        const newTotalReceived = parseFloat((balance as any).total_received || '0');
        
        trimmedTokens[contractId] = {
          balance: (existingBalance + newBalance).toString(),
          total_sent: (existingTotalSent + newTotalSent).toString(),
          total_received: (existingTotalReceived + newTotalReceived).toString()
        };
        
        await logger.info(`    Result: ${existingBalance + newBalance}`);
      } else {
        await logger.info(`    First occurrence, adding directly`);
        trimmedTokens[contractId] = balance;
      }
    }
    
    // Show final result
    const finalBalance = trimmedTokens[targetContractId];
    if (finalBalance) {
      await logger.info(`\n📊 Final merged balance: ${finalBalance.balance}`);
      await logger.info(`   total_sent: ${finalBalance.total_sent}`);
      await logger.info(`   total_received: ${finalBalance.total_received}`);
    }
    
    // Now test with the actual polyglot function
    await logger.info('\n🧪 Testing with actual polyglot function:');
    const trimmedResponse = await getAccountBalances(TEST_ADDRESS, { trim: true });
    
    if (trimmedResponse) {
      const actualBalance = trimmedResponse.fungible_tokens?.[targetContractId];
      if (actualBalance) {
        await logger.info(`📊 Polyglot result: ${actualBalance.balance}`);
        await logger.info(`   total_sent: ${actualBalance.total_sent}`);
        await logger.info(`   total_received: ${actualBalance.total_received}`);
        
        // Compare results
        const manualBalance = parseFloat(finalBalance.balance);
        const polyglotBalance = parseFloat(actualBalance.balance);
        
        await logger.info(`\n🔍 Comparison:`);
        await logger.info(`   Manual: ${manualBalance}`);
        await logger.info(`   Polyglot: ${polyglotBalance}`);
        await logger.info(`   Match: ${manualBalance === polyglotBalance ? '✅' : '❌'}`);
      } else {
        await logger.error('❌ Token not found in polyglot response');
      }
    } else {
      await logger.error('❌ Failed to get polyglot response');
    }
    
  } catch (error) {
    await logger.error(`❌ Error: ${error}`);
  }
}

async function main() {
  await logger.info('🚀 Test API Response Processing');
  await logger.info('==============================');
  
  await testApiResponse();
  
  await logger.success('Test completed!');
}

main().catch(console.error);