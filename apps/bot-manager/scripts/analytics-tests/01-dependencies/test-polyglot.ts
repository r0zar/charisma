#!/usr/bin/env node

/**
 * Test Polyglot Integration
 * Tests the @repo/polyglot getTransactionEvents function
 * Usage: node --import tsx scripts/analytics-tests/01-dependencies/test-polyglot.ts
 */

import { getTransactionEvents } from '@repo/polyglot';
import { logger, logExecution, logResult, logError } from '../../logger';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Test wallet addresses with known transaction history
const TEST_WALLETS = {
  'yield-farming': 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
  'active-trader': 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R',
  'hodler': 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM',
};

async function testBasicFunctionality() {
  console.log('\n🔍 Test 1: Basic Functionality');
  console.log('================================');
  
  const testWallet = TEST_WALLETS['yield-farming'];
  console.log(`Testing wallet: ${testWallet.slice(0, 8)}...`);
  
  try {
    const result = await getTransactionEvents({
      address: testWallet,
      limit: 10,
    });
    
    console.log('✅ Basic call successful');
    console.log(`📊 Result type: ${typeof result}`);
    console.log(`📋 Has events: ${!!result?.events}`);
    console.log(`📈 Events count: ${result?.events?.length || 0}`);
    console.log(`🔢 API limit: ${result?.limit || 'N/A'}`);
    console.log(`🔢 API offset: ${result?.offset || 'N/A'}`);
    
    await logger.success('Polyglot basic functionality test passed', {
      wallet: testWallet,
      eventCount: result?.events?.length || 0,
      resultType: typeof result,
    });
    
    return { success: true, eventCount: result?.events?.length || 0 };
  } catch (error) {
    console.error('❌ Basic call failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Polyglot basic functionality test failed', { 
      wallet: testWallet, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testDifferentParameters() {
  console.log('\n🔍 Test 2: Different Parameters');
  console.log('================================');
  
  const testWallet = TEST_WALLETS['yield-farming'];
  const testCases = [
    { name: 'Small limit', params: { address: testWallet, limit: 5 } },
    { name: 'Large limit', params: { address: testWallet, limit: 100 } },
    { name: 'With offset', params: { address: testWallet, limit: 10, offset: 5 } },
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\n📝 Testing: ${testCase.name}`);
    try {
      const result = await getTransactionEvents(testCase.params);
      console.log(`✅ ${testCase.name} successful - ${result?.events?.length || 0} events`);
      results.push({ name: testCase.name, success: true, eventCount: result?.events?.length || 0 });
    } catch (error) {
      console.error(`❌ ${testCase.name} failed:`, error instanceof Error ? error.message : String(error));
      results.push({ name: testCase.name, success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  await logger.info('Polyglot parameter testing completed', { results });
  return results;
}

async function testMultipleWallets() {
  console.log('\n🔍 Test 3: Multiple Wallets');
  console.log('=============================');
  
  const results = [];
  
  for (const [walletType, walletAddress] of Object.entries(TEST_WALLETS)) {
    console.log(`\n📝 Testing: ${walletType} (${walletAddress.slice(0, 8)}...)`);
    try {
      const result = await getTransactionEvents({
        address: walletAddress,
        limit: 5,
      });
      console.log(`✅ ${walletType} successful - ${result?.events?.length || 0} events`);
      results.push({ 
        walletType, 
        address: walletAddress, 
        success: true, 
        eventCount: result?.events?.length || 0 
      });
    } catch (error) {
      console.error(`❌ ${walletType} failed:`, error instanceof Error ? error.message : String(error));
      results.push({ 
        walletType, 
        address: walletAddress, 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
  
  await logger.info('Polyglot multiple wallet testing completed', { results });
  return results;
}

async function testEventTypes() {
  console.log('\n🔍 Test 4: Event Types Analysis');
  console.log('=================================');
  
  const testWallet = TEST_WALLETS['yield-farming'];
  
  try {
    const result = await getTransactionEvents({
      address: testWallet,
      limit: 50,
    });
    
    if (!result?.events || result.events.length === 0) {
      console.log('❌ No events found for analysis');
      return { success: false, error: 'No events found' };
    }
    
    // Analyze event types
    const eventTypeCounts: Record<string, number> = {};
    const assetTypes: Record<string, number> = {};
    
    result.events.forEach((event: any) => {
      const eventType = event.event_type;
      eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;
      
      if (event.asset?.asset_id) {
        const assetId = event.asset.asset_id;
        assetTypes[assetId] = (assetTypes[assetId] || 0) + 1;
      }
    });
    
    console.log('✅ Event analysis successful');
    console.log('\n📊 Event Type Breakdown:');
    Object.entries(eventTypeCounts).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    console.log('\n🪙 Asset Type Breakdown:');
    Object.entries(assetTypes).slice(0, 5).forEach(([asset, count]) => {
      console.log(`   ${asset}: ${count}`);
    });
    
    await logger.info('Polyglot event types analysis completed', {
      wallet: testWallet,
      totalEvents: result.events.length,
      eventTypes: eventTypeCounts,
      topAssets: Object.entries(assetTypes).slice(0, 5),
    });
    
    return { 
      success: true, 
      totalEvents: result.events.length,
      eventTypes: eventTypeCounts,
      assetTypes: Object.keys(assetTypes).length
    };
  } catch (error) {
    console.error('❌ Event analysis failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Polyglot event types analysis failed', { 
      wallet: testWallet, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  try {
    const startTime = Date.now();
    
    await logExecution('Polyglot Integration Test', 'Testing @repo/polyglot getTransactionEvents function');
    
    console.log('🧪 Polyglot Integration Test');
    console.log('============================');
    console.log('Testing @repo/polyglot getTransactionEvents function\n');
    
    // Run all tests
    const test1 = await testBasicFunctionality();
    const test2 = await testDifferentParameters();
    const test3 = await testMultipleWallets();
    const test4 = await testEventTypes();
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`✅ Basic functionality: ${test1.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Parameter variations: ${test2.every(r => r.success) ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Multiple wallets: ${test3.every(r => r.success) ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Event type analysis: ${test4.success ? 'PASS' : 'FAIL'}`);
    
    const allPassed = test1.success && 
                     test2.every(r => r.success) && 
                     test3.every(r => r.success) && 
                     test4.success;
    
    const duration = Date.now() - startTime;
    await logResult('Polyglot Integration Test', {
      exitCode: allPassed ? 0 : 1,
      stdout: allPassed ? 'All tests passed' : 'Some tests failed',
      summary: {
        basicFunctionality: test1.success,
        parameterTests: test2.filter(r => r.success).length + '/' + test2.length,
        walletTests: test3.filter(r => r.success).length + '/' + test3.length,
        eventAnalysis: test4.success,
        totalDuration: duration + 'ms',
      }
    }, duration);
    
    if (allPassed) {
      console.log('\n🎉 All Polyglot tests PASSED!');
      console.log('✅ @repo/polyglot integration is working correctly');
    } else {
      console.log('\n❌ Some Polyglot tests FAILED!');
      console.log('🔧 Check the logs for detailed error information');
      process.exit(1);
    }
    
  } catch (error) {
    await logError('Polyglot Integration Test failed', error instanceof Error ? error : new Error(String(error)));
    console.error('\n❌ Test script failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  await logError('Polyglot Integration Test crashed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});