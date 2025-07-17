#!/usr/bin/env tsx

import { fetchBotBalances, fetchSingleBotBalance } from '../src/app/settings/actions/bot-balances';
import { logger } from './logger';

// Test wallet addresses - you can replace these with actual bot wallet addresses
const TEST_ADDRESSES = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', // Example address - replace with real bot addresses
  'SP1ABC123DEF456GHI789JKL012MNO345PQR678ST', // Example address - replace with real bot addresses
];

// LP tokens to check for
const YIELD_FARMING_LP_TOKENS = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit',
];

const REWARD_TOKEN = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl';

// Helper function to extract contract ID from tokenKey
function extractContractId(tokenKey: string): string {
  const colonIndex = tokenKey.indexOf('::');
  return colonIndex !== -1 ? tokenKey.substring(0, colonIndex) : tokenKey;
}

// Helper function to find token balance (handles tokenKey suffixes)
function findTokenBalance(balances: any, contractId: string): any {
  // First try exact match
  let tokenBalance = balances.fungible_tokens?.[contractId];
  
  // If not found, search for tokens with ::identifier suffix
  if (!tokenBalance) {
    const fungibleTokens = balances.fungible_tokens || {};
    for (const [tokenKey, tokenData] of Object.entries(fungibleTokens)) {
      if (extractContractId(tokenKey) === contractId) {
        tokenBalance = tokenData;
        break;
      }
    }
  }
  
  return tokenBalance;
}

async function testSingleBalance(address: string) {
  await logger.info(`\n🧪 Testing balance fetch for address: ${address}`);
  await logger.info('='.repeat(60));
  
  try {
    const result = await fetchSingleBotBalance(address);
    
    if (result.error) {
      await logger.error(`❌ Error: ${result.error}`);
      return;
    }
    
    if (!result.balances) {
      await logger.warn(`⚠️  No balances returned`);
      return;
    }
    
    const balances = result.balances;
    
    // Show STX balance
    const stxBalance = balances.stx?.balance || '0';
    const stxFormatted = parseFloat(stxBalance) / 1000000; // Convert from microSTX
    await logger.info(`💰 STX Balance: ${stxFormatted.toFixed(6)} STX (${stxBalance} microSTX)`);
    
    // Show all fungible tokens
    const fungibleTokens = balances.fungible_tokens || {};
    const tokenCount = Object.keys(fungibleTokens).length;
    await logger.info(`🪙 Fungible Tokens: ${tokenCount} found`);
    
    if (tokenCount > 0) {
      await logger.info('\nToken details:');
      for (const [tokenKey, tokenData] of Object.entries(fungibleTokens)) {
        const contractId = extractContractId(tokenKey);
        const balance = parseFloat((tokenData as any).balance || '0');
        const hasPrefix = tokenKey.includes('::');
        
        await logger.info(`  • ${tokenKey}`);
        await logger.info(`    Contract ID: ${contractId}`);
        await logger.info(`    Balance: ${balance}`);
        await logger.info(`    Has suffix: ${hasPrefix ? '✅' : '❌'}`);
        
        if (hasPrefix) {
          await logger.warn(`    ⚠️  TokenKey suffix detected: ${tokenKey.split('::')[1]}`);
        }
      }
    }
    
    // Test LP token detection
    await logger.info('\n🔍 Testing LP Token Detection:');
    for (const contractId of YIELD_FARMING_LP_TOKENS) {
      const tokenBalance = findTokenBalance(balances, contractId);
      if (tokenBalance) {
        const balance = parseFloat(tokenBalance.balance || '0');
        await logger.info(`  ✅ ${contractId}: ${balance}`);
      } else {
        await logger.info(`  ❌ ${contractId}: Not found`);
      }
    }
    
    // Test reward token detection
    await logger.info('\n🎁 Testing Reward Token Detection:');
    const rewardToken = findTokenBalance(balances, REWARD_TOKEN);
    if (rewardToken) {
      const balance = parseFloat(rewardToken.balance || '0');
      await logger.info(`  ✅ ${REWARD_TOKEN}: ${balance}`);
    } else {
      await logger.info(`  ❌ ${REWARD_TOKEN}: Not found`);
    }
    
  } catch (error) {
    await logger.error(`❌ Error fetching balance for ${address}: ${error}`);
  }
}

async function testMultipleBalances() {
  await logger.info('\n🧪 Testing multiple balance fetch');
  await logger.info('='.repeat(60));
  
  try {
    const results = await fetchBotBalances(TEST_ADDRESSES);
    
    await logger.info(`📊 Fetched balances for ${results.length} addresses`);
    
    for (const result of results) {
      await logger.info(`\n📍 Address: ${result.address}`);
      if (result.error) {
        await logger.error(`  ❌ Error: ${result.error}`);
      } else if (result.balances) {
        const stxBalance = result.balances.stx?.balance || '0';
        const stxFormatted = parseFloat(stxBalance) / 1000000;
        const tokenCount = Object.keys(result.balances.fungible_tokens || {}).length;
        await logger.info(`  💰 STX: ${stxFormatted.toFixed(6)} STX`);
        await logger.info(`  🪙 Tokens: ${tokenCount}`);
      } else {
        await logger.warn(`  ⚠️  No balances`);
      }
    }
    
  } catch (error) {
    await logger.error(`❌ Error fetching multiple balances: ${error}`);
  }
}

async function main() {
  await logger.info('🚀 Bot Balance Fetch Test Script');
  await logger.info('================================');
  
  // Test each address individually
  for (const address of TEST_ADDRESSES) {
    await testSingleBalance(address);
  }
  
  // Test multiple addresses at once
  await testMultipleBalances();
  
  await logger.success('Test completed!');
  await logger.info('\n💡 Tips:');
  await logger.info('  - Replace TEST_ADDRESSES with actual bot wallet addresses');
  await logger.info('  - Look for tokens with :: suffixes to verify tokenKey handling');
  await logger.info('  - Check that LP tokens are detected correctly');
  await logger.info('  - Verify STX balance conversion from microSTX');
}

main().catch(console.error);