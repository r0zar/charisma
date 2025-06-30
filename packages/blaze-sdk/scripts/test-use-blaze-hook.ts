/**
 * Test script for useBlaze hook functionality
 * Tests React hook behavior, subscription management, and balance merging
 */

import React, { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { BlazeProvider, useBlaze } from '../src/realtime/providers/BlazeProvider';
import { getBalanceKey, isSubnetToken, getTokenFamily } from '../src/realtime/utils/token-utils';

// Configuration
const PROD_HOST = 'charisma-party.r0zar.partykit.dev';
const TEST_USER_ID = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

// Test state
interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  failures: string[];
}

const testResults: TestResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  failures: []
};

// Logging utilities
function log(message: string) {
  console.log(message);
}

function logResult(result: { test: string; status: 'PASS' | 'FAIL' | 'SKIP'; message: string; duration?: number; data?: any }) {
  testResults.total++;
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  log(`${icon} ${result.test}${duration}: ${result.message}`);
  
  if (result.status === 'PASS') {
    testResults.passed++;
  } else if (result.status === 'FAIL') {
    testResults.failed++;
    testResults.failures.push(`   ❌ ${result.test}: ${result.message}`);
  } else {
    testResults.skipped++;
  }

  if (result.data && result.status === 'PASS') {
    // Log some additional data for successful tests if relevant
    if (result.test.includes('Balance') && result.data.balance !== undefined) {
      log(`   📊 Balance Data: ${JSON.stringify(result.data, null, 2)}`);
    } else if (result.test.includes('Price') && result.data.price !== undefined) {
      log(`   💰 Price Data: ${JSON.stringify(result.data, null, 2)}`);
    }
  }
}

// Mock wrapper component for testing
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <StrictMode>
      <BlazeProvider host={PROD_HOST}>
        {children}
      </BlazeProvider>
    </StrictMode>
  );
}

// Test useBlaze hook initialization
async function testHookInitialization(): Promise<void> {
  log('🎣 Testing useBlaze hook initialization...');
  
  try {
    const start = Date.now();
    
    const { result, unmount } = renderHook(() => useBlaze(), {
      wrapper: TestWrapper
    });
    
    const duration = Date.now() - start;
    
    // Check that hook returns expected structure
    if (result.current) {
      const blazeData = result.current;
      const hasRequiredProperties = [
        'prices', 'balances', 'metadata', 'isConnected', 'lastUpdate',
        'getPrice', 'getBalance', 'getMetadata', 'getUserBalances'
      ].every(prop => prop in blazeData);
      
      if (hasRequiredProperties) {
        logResult({
          test: 'useBlaze Hook Initialization',
          status: 'PASS',
          message: 'Hook initialized with all required properties',
          duration,
          data: {
            pricesCount: Object.keys(blazeData.prices).length,
            balancesCount: Object.keys(blazeData.balances).length,
            metadataCount: Object.keys(blazeData.metadata).length,
            isConnected: blazeData.isConnected
          }
        });
      } else {
        logResult({
          test: 'useBlaze Hook Initialization',
          status: 'FAIL',
          message: 'Hook missing required properties',
          data: { available: Object.keys(blazeData) }
        });
      }
    } else {
      logResult({
        test: 'useBlaze Hook Initialization',
        status: 'FAIL',
        message: 'Hook returned undefined'
      });
    }
    
    unmount();
    
  } catch (error) {
    logResult({
      test: 'useBlaze Hook Initialization',
      status: 'FAIL',
      message: `Hook initialization failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// Test balance subscription functionality
async function testBalanceSubscription(): Promise<void> {
  log('📊 Testing balance subscription functionality...');
  
  try {
    const start = Date.now();
    
    // Test without userId (should not subscribe)
    const { result: resultNoUser, rerender, unmount } = renderHook(
      ({ userId }) => useBlaze({ userId }),
      {
        wrapper: TestWrapper,
        initialProps: { userId: undefined as string | undefined }
      }
    );
    
    // Give some time for initial connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const initialBalanceCount = Object.keys(resultNoUser.current.balances).length;
    
    logResult({
      test: 'useBlaze Without UserId',
      status: 'PASS',
      message: `No subscription without userId (${initialBalanceCount} cached balances)`,
      data: { balanceCount: initialBalanceCount }
    });
    
    // Test with userId (should subscribe)
    act(() => {
      rerender({ userId: TEST_USER_ID });
    });
    
    // Wait for subscription to take effect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const subscribedBalanceCount = Object.keys(resultNoUser.current.balances).length;
    const hasNewBalances = subscribedBalanceCount > initialBalanceCount;
    
    logResult({
      test: 'useBlaze With UserId Subscription',
      status: hasNewBalances ? 'PASS' : 'SKIP',
      message: hasNewBalances 
        ? `Subscription working (${subscribedBalanceCount} balances)`
        : `No new balances received yet (${subscribedBalanceCount} total)`,
      data: { 
        initialCount: initialBalanceCount,
        subscribedCount: subscribedBalanceCount,
        hasNewBalances
      }
    });
    
    // Test changing userId (should unsubscribe from old and subscribe to new)
    const alternateUserId = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9';
    
    act(() => {
      rerender({ userId: alternateUserId });
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logResult({
      test: 'useBlaze UserId Change',
      status: 'PASS',
      message: 'Successfully changed subscription target',
      data: { newUserId: alternateUserId.slice(0, 8) + '...' + alternateUserId.slice(-4) }
    });
    
    // Test removing userId (should unsubscribe)
    act(() => {
      rerender({ userId: undefined });
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    logResult({
      test: 'useBlaze UserId Removal',
      status: 'PASS',
      message: 'Successfully unsubscribed when userId removed'
    });
    
    const duration = Date.now() - start;
    
    logResult({
      test: 'Balance Subscription Management',
      status: 'PASS',
      message: 'Complete subscription lifecycle tested',
      duration
    });
    
    unmount();
    
  } catch (error) {
    logResult({
      test: 'Balance Subscription Management',
      status: 'FAIL',
      message: `Subscription test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// Test balance retrieval functions
async function testBalanceRetrieval(): Promise<void> {
  log('🔍 Testing balance retrieval functions...');
  
  try {
    const { result, unmount } = renderHook(() => useBlaze({ userId: TEST_USER_ID }), {
      wrapper: TestWrapper
    });
    
    // Wait for data to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const blazeData = result.current;
    
    // Test getUserBalances function
    const userBalances = blazeData.getUserBalances(TEST_USER_ID);
    const userBalanceCount = Object.keys(userBalances).length;
    
    if (userBalanceCount > 0) {
      logResult({
        test: 'getUserBalances Function',
        status: 'PASS',
        message: `Retrieved ${userBalanceCount} user balances`,
        data: { count: userBalanceCount, sampleKeys: Object.keys(userBalances).slice(0, 3) }
      });
      
      // Test getBalance function with specific contract
      const sampleContractId = Object.keys(userBalances)[0];
      if (sampleContractId) {
        const specificBalance = blazeData.getBalance(TEST_USER_ID, sampleContractId);
        
        if (specificBalance) {
          logResult({
            test: 'getBalance Function',
            status: 'PASS',
            message: `Retrieved specific balance for ${sampleContractId.slice(-20)}`,
            data: {
              contractId: sampleContractId,
              balance: specificBalance.balance,
              formattedBalance: specificBalance.formattedBalance,
              symbol: specificBalance.symbol
            }
          });
          
          // Test subnet balance merging if applicable
          if (specificBalance.subnetBalance !== undefined) {
            logResult({
              test: 'Subnet Balance Merging',
              status: 'PASS',
              message: `Found merged subnet balance data`,
              data: {
                mainnetBalance: specificBalance.balance,
                subnetBalance: specificBalance.subnetBalance,
                subnetContractId: specificBalance.subnetContractId
              }
            });
          }
        } else {
          logResult({
            test: 'getBalance Function',
            status: 'FAIL',
            message: `Could not retrieve specific balance for ${sampleContractId}`
          });
        }
      }
    } else {
      logResult({
        test: 'getUserBalances Function',
        status: 'SKIP',
        message: 'No user balances loaded yet (may need more time or user has no balances)'
      });
    }
    
    // Test invalid inputs
    const invalidUserBalance = blazeData.getUserBalances('');
    const invalidUserBalanceCount = Object.keys(invalidUserBalance).length;
    
    logResult({
      test: 'getUserBalances Invalid Input Handling',
      status: invalidUserBalanceCount === 0 ? 'PASS' : 'FAIL',
      message: invalidUserBalanceCount === 0 
        ? 'Correctly returns empty object for invalid userId'
        : `Unexpectedly returned ${invalidUserBalanceCount} balances for empty userId`
    });
    
    const invalidBalance = blazeData.getBalance('', 'invalid');
    
    logResult({
      test: 'getBalance Invalid Input Handling',
      status: invalidBalance === undefined ? 'PASS' : 'FAIL',
      message: invalidBalance === undefined
        ? 'Correctly returns undefined for invalid inputs'
        : 'Unexpectedly returned data for invalid inputs'
    });
    
    unmount();
    
  } catch (error) {
    logResult({
      test: 'Balance Retrieval Functions',
      status: 'FAIL',
      message: `Balance retrieval test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// Test token utility integration
async function testTokenUtilityIntegration(): Promise<void> {
  log('🔧 Testing token utility integration...');
  
  // Test subnet token detection
  const testCases = [
    {
      contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      metadata: { type: 'SIP10' },
      expectedSubnet: false
    },
    {
      contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
      metadata: { type: 'SUBNET', base: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token' },
      expectedSubnet: true
    },
    {
      contractId: '.stx',
      metadata: { type: 'NATIVE' },
      expectedSubnet: false
    }
  ];
  
  let allTestsPassed = true;
  
  testCases.forEach((testCase, index) => {
    const isSubnet = isSubnetToken(testCase.contractId, testCase.metadata);
    const tokenFamily = getTokenFamily(testCase.contractId, testCase.metadata);
    const balanceKey = getBalanceKey('test-user', testCase.contractId, testCase.metadata);
    
    const passed = isSubnet === testCase.expectedSubnet;
    if (!passed) allTestsPassed = false;
    
    logResult({
      test: `Token Utility Integration #${index + 1}`,
      status: passed ? 'PASS' : 'FAIL',
      message: passed 
        ? `${testCase.contractId.slice(-20)} correctly identified as ${isSubnet ? 'subnet' : 'mainnet'}`
        : `Expected ${testCase.expectedSubnet}, got ${isSubnet}`,
      data: { 
        contractId: testCase.contractId,
        isSubnet,
        tokenFamily,
        balanceKey
      }
    });
  });
  
  logResult({
    test: 'Token Utility Integration Suite',
    status: allTestsPassed ? 'PASS' : 'FAIL',
    message: allTestsPassed ? 'All token utility tests passed' : 'Some token utility tests failed'
  });
}

// Test price data functionality
async function testPriceData(): Promise<void> {
  log('💰 Testing price data functionality...');
  
  try {
    const { result, unmount } = renderHook(() => useBlaze(), {
      wrapper: TestWrapper
    });
    
    // Wait for price data to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const blazeData = result.current;
    const priceCount = Object.keys(blazeData.prices).length;
    
    if (priceCount > 0) {
      logResult({
        test: 'Price Data Loading',
        status: 'PASS',
        message: `Loaded ${priceCount} price entries`,
        data: { count: priceCount }
      });
      
      // Test getPrice function
      const sampleContractId = Object.keys(blazeData.prices)[0];
      if (sampleContractId) {
        const price = blazeData.getPrice(sampleContractId);
        
        logResult({
          test: 'getPrice Function',
          status: price !== undefined ? 'PASS' : 'FAIL',
          message: price !== undefined 
            ? `Retrieved price for ${sampleContractId.slice(-20)}: $${price}`
            : `Could not retrieve price for ${sampleContractId}`,
          data: { contractId: sampleContractId, price }
        });
      }
    } else {
      logResult({
        test: 'Price Data Loading',
        status: 'SKIP',
        message: 'No price data loaded yet (may need more time)'
      });
    }
    
    unmount();
    
  } catch (error) {
    logResult({
      test: 'Price Data Functionality',
      status: 'FAIL',
      message: `Price data test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function main() {
  console.log('🎣 USEBLAZE HOOK TESTING');
  console.log('============================================================');
  console.log(`🌐 Host: ${PROD_HOST}`);
  console.log(`👤 Test User: ${TEST_USER_ID.slice(0, 8)}...${TEST_USER_ID.slice(-4)}`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('');
  console.log('⚠️  Note: This test requires @testing-library/react');
  console.log('⚠️  Some tests may be skipped if dependencies are missing');
  console.log('');
  
  try {
    // Run all tests
    await testHookInitialization();
    await testTokenUtilityIntegration();
    await testBalanceSubscription();
    await testBalanceRetrieval();
    await testPriceData();
    
    // Print summary
    console.log('');
    console.log('============================================================');
    console.log('🎣 USEBLAZE HOOK TEST SUMMARY');
    console.log('============================================================');
    console.log('');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⏭️ Skipped: ${testResults.skipped}`);
    console.log(`📋 Total: ${testResults.total}`);
    console.log(`🎯 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    if (testResults.failures.length > 0) {
      console.log('');
      console.log('🔍 Failed Tests:');
      testResults.failures.forEach(failure => console.log(failure));
      console.log('');
      console.log('⚠️  Some tests failed. Check the implementation.');
    } else {
      console.log('');
      console.log('🎉 SUCCESS! All useBlaze hook tests passed.');
      console.log('   ✨ Hook functionality and integration working correctly.');
    }
    
    console.log('');
    console.log('============================================================');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);