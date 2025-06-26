#!/usr/bin/env tsx

/**
 * Test Subnet Balance Detection
 * 
 * This script unit tests the subnet balance detection functions from balances-lib.ts
 * to verify that subnet tokens are properly identified and processed.
 */

import { loadTokenMetadata, fetchTokenSummariesFromAPI, createBalanceUpdateMessage, EnhancedTokenRecord } from '../src/balances-lib';

async function testSubnetBalanceDetection() {
  console.log('🧪 TESTING SUBNET BALANCE DETECTION');
  console.log('==================================\n');

  try {
    // Step 1: Test token summaries API
    console.log('📋 STEP 1: Testing token summaries API...');
    console.log('=========================================');
    
    const tokenSummaries = await fetchTokenSummariesFromAPI();
    console.log(`✅ Fetched ${tokenSummaries.length} token summaries`);
    
    // Check for CHA tokens specifically
    const chaTokens = tokenSummaries.filter(token => 
      token.symbol === 'CHA' || token.contractId.includes('charisma-token')
    );
    
    console.log(`\n🔍 Found ${chaTokens.length} CHA-related tokens:`);
    chaTokens.forEach(token => {
      console.log(`- ${token.symbol} (${token.contractId})`);
      console.log(`  Type: ${token.type || 'undefined'}`);
      console.log(`  Base: ${token.base || 'undefined'}`);
      console.log(`  Price: ${token.price ? `$${token.price}` : 'none'}`);
    });

    // Step 2: Test metadata loading
    console.log('\n📋 STEP 2: Testing metadata loading...');
    console.log('=====================================');
    
    const enhancedTokenRecords = await loadTokenMetadata();
    console.log(`✅ Loaded ${enhancedTokenRecords.size} enhanced token records`);
    
    // Filter for subnet tokens
    const allTokens = Array.from(enhancedTokenRecords.values());
    const subnetTokens = allTokens.filter(record => record.type === 'SUBNET');
    
    console.log(`\n📊 Found ${subnetTokens.length} subnet tokens out of ${allTokens.length} total tokens:`);
    subnetTokens.forEach(token => {
      console.log(`- ${token.symbol} (${token.contractId})`);
      console.log(`  Type: ${token.type}`);
      console.log(`  Base: ${token.base || 'undefined'}`);
      console.log(`  Has Price: ${token.price !== null ? 'Yes' : 'No'}`);
    });

    // Step 3: Test CHA subnet token specifically
    console.log('\n📋 STEP 3: Testing CHA subnet token specifically...');
    console.log('===================================================');
    
    const chaSubnetToken = subnetTokens.find(token => 
      token.contractId === 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1'
    );
    
    if (chaSubnetToken) {
      console.log('✅ CHA subnet token found in enhanced records:');
      console.log(`   Contract: ${chaSubnetToken.contractId}`);
      console.log(`   Symbol: ${chaSubnetToken.symbol}`);
      console.log(`   Type: ${chaSubnetToken.type}`);
      console.log(`   Base: ${chaSubnetToken.base || 'undefined'}`);
      console.log(`   Expected Base: SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token`);
      
      const hasCorrectBase = chaSubnetToken.base === 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
      console.log(`   Base Mapping Correct: ${hasCorrectBase ? '✅' : '❌'}`);
      
      if (!hasCorrectBase) {
        console.log('❌ CHA subnet token does not have correct base mapping!');
        console.log('   This explains why subnet balances are not appearing in websocket data.');
      }
    } else {
      console.log('❌ CHA subnet token NOT found in enhanced records!');
    }

    // Step 4: Test balance message creation for CHA tokens
    console.log('\n📋 STEP 4: Testing balance message creation...');
    console.log('==============================================');
    
    const chaMainnetToken = allTokens.find(token => 
      token.contractId === 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
    );
    
    if (chaMainnetToken) {
      console.log('✅ Testing balance message creation for CHA mainnet token...');
      
      const mockBalanceInfo = {
        balance: 1000000,
        totalSent: '0',
        totalReceived: '1000000',
        formattedBalance: 1.0,
        timestamp: Date.now(),
        source: 'hiro-api'
      };
      
      const mockSubnetBalanceInfo = chaSubnetToken ? {
        contractId: chaSubnetToken.contractId,
        balance: 500000,
        totalSent: '0',
        totalReceived: '500000', 
        formattedBalance: 0.5,
        timestamp: Date.now(),
        source: 'subnet-contract-call'
      } : undefined;
      
      // Create mock balance updates with subnet balance data
      const mockAllBalanceUpdates = chaSubnetToken ? {
        'SP1HTBVD3JG9C05J7HBJTHGR0GGS7RH5C1CQBVWX:SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token': {
          userId: 'SP1HTBVD3JG9C05J7HBJTHGR0GGS7RH5C1CQBVWX',
          contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
          balance: 1000000,
          totalSent: '0',
          totalReceived: '1000000',
          timestamp: Date.now(),
          source: 'hiro-api'
        },
        [`SP1HTBVD3JG9C05J7HBJTHGR0GGS7RH5C1CQBVWX:${chaSubnetToken.contractId}`]: {
          userId: 'SP1HTBVD3JG9C05J7HBJTHGR0GGS7RH5C1CQBVWX',
          contractId: chaSubnetToken.contractId,
          balance: 500000,
          totalSent: '0',
          totalReceived: '500000',
          timestamp: Date.now(),
          source: 'subnet-contract-call'
        }
      } : {};
      
      console.log('🔍 Creating balance update message with auto-discovery...');
      
      const balanceMessage = createBalanceUpdateMessage(
        chaMainnetToken,
        'SP1HTBVD3JG9C05J7HBJTHGR0GGS7RH5C1CQBVWX',
        mockBalanceInfo,
        enhancedTokenRecords, // Pass enhanced token records for auto-discovery
        mockAllBalanceUpdates // Pass balance updates for auto-discovery
      );
      
      console.log('\n📄 Balance message created:');
      console.log(`   Contract ID: ${balanceMessage.contractId}`);
      console.log(`   Symbol: ${balanceMessage.symbol}`);
      console.log(`   Balance: ${balanceMessage.balance}`);
      console.log(`   Formatted Balance: ${balanceMessage.formattedBalance}`);
      console.log(`   Subnet Balance: ${balanceMessage.subnetBalance || 'undefined'}`);
      console.log(`   Subnet Contract ID: ${balanceMessage.subnetContractId || 'undefined'}`);
      console.log(`   Base Token: ${balanceMessage.baseToken || 'undefined'}`);
      console.log(`   Metadata Base: ${balanceMessage.metadata?.base || 'undefined'}`);
      
      const hasSubnetFields = balanceMessage.subnetBalance !== undefined && balanceMessage.subnetContractId !== undefined;
      console.log(`   Has Subnet Fields: ${hasSubnetFields ? '✅' : '❌'}`);
      
    } else {
      console.log('❌ CHA mainnet token NOT found in enhanced records!');
    }

    // Step 5: Summary and recommendations
    console.log('\n📋 STEP 5: Summary and Recommendations...');
    console.log('=========================================');
    
    const issues = [];
    
    if (subnetTokens.length === 0) {
      issues.push('No subnet tokens found in enhanced records');
    }
    
    if (!chaSubnetToken) {
      issues.push('CHA subnet token not found');
    } else if (chaSubnetToken.base !== 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token') {
      issues.push('CHA subnet token has incorrect base mapping');
    }
    
    if (!chaMainnetToken) {
      issues.push('CHA mainnet token not found');
    }
    
    if (issues.length > 0) {
      console.log('❌ Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('\n💡 Recommendations:');
      console.log('   1. Check token-summaries API data source');
      console.log('   2. Verify KV storage has correct subnet mappings');
      console.log('   3. Clear token-summaries cache to force refresh');
      console.log('   4. Check if subnet tokens are being filtered out');
    } else {
      console.log('✅ All checks passed! Subnet balance detection should work correctly.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Show usage information
function showUsage() {
  console.log('Usage: pnpm script test-subnet-balance-detection');
  console.log('\nDescription:');
  console.log('  Unit tests the subnet balance detection functions from balances-lib.ts');
  console.log('  to verify that subnet tokens are properly identified and processed.');
  console.log('\nChecks:');
  console.log('  - Token summaries API data');
  console.log('  - Enhanced token records creation');
  console.log('  - Subnet token filtering');
  console.log('  - CHA subnet token base mapping');
  console.log('  - Balance message creation with subnet fields');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

testSubnetBalanceDetection().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});