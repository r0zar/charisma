#!/usr/bin/env tsx

/**
 * Production Balance Fetching Test Script
 * Tests balance fetching in production context to validate BalancesParty behavior
 * 
 * Usage: pnpm script production-balance-test [userId]
 * Example: pnpm script production-balance-test SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
 */

import { fetchUserBalances, loadTokenMetadata } from '../src/balances-lib.js';

// Configuration
const DEFAULT_TEST_USER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

interface BalanceTestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
  data?: any;
}

const results: BalanceTestResult[] = [];

function log(message: string) {
  console.log(`🧪 ${message}`);
}

function logResult(result: BalanceTestResult) {
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  console.log(`${emoji} ${result.test}${duration}: ${result.message}`);
  results.push(result);
}

async function testTokenMetadataPrerequisite() {
  log('Testing token metadata loading (prerequisite for balance fetching)...');
  
  try {
    const start = Date.now();
    const tokenRecords = await loadTokenMetadata();
    const duration = Date.now() - start;
    
    logResult({
      test: 'Token Metadata Loading',
      status: 'PASS',
      message: `Loaded ${tokenRecords.size} token records`,
      duration,
      data: { count: tokenRecords.size }
    });
    
    return tokenRecords;
    
  } catch (error) {
    logResult({
      test: 'Token Metadata Loading',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function testSingleUserBalanceFetching(userId: string, tokenRecords: Map<string, any>) {
  log(`Testing balance fetching for single user: ${userId.slice(0, 8)}...${userId.slice(-4)}`);
  
  try {
    const start = Date.now();
    const rawBalances = await fetchUserBalances([userId], tokenRecords);
    const duration = Date.now() - start;
    
    const balanceCount = Object.keys(rawBalances).length;
    
    logResult({
      test: 'Single User Balance Fetch',
      status: 'PASS',
      message: `Retrieved ${balanceCount} balance entries`,
      duration,
      data: { 
        userId, 
        balanceCount,
        sampleKeys: Object.keys(rawBalances).slice(0, 5)
      }
    });
    
    // Analyze the balance data
    await analyzeBalanceData(rawBalances, tokenRecords, userId);
    
    return rawBalances;
    
  } catch (error) {
    logResult({
      test: 'Single User Balance Fetch',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function analyzeBalanceData(rawBalances: Record<string, any>, tokenRecords: Map<string, any>, userId: string) {
  log('Analyzing balance data structure and content...');
  
  // Check for STX balance specifically
  const stxEntries = Object.entries(rawBalances).filter(([key, data]) => 
    data.contractId === '.stx' || key.includes('.stx') || data.contractId.includes('stx')
  );
  
  if (stxEntries.length > 0) {
    const [stxKey, stxData] = stxEntries[0];
    logResult({
      test: 'STX Balance Detection',
      status: 'PASS',
      message: `STX balance found: ${stxData.balance} (key: ${stxKey})`,
      data: {
        key: stxKey,
        balance: stxData.balance,
        contractId: stxData.contractId,
        fullData: stxData
      }
    });
  } else {
    logResult({
      test: 'STX Balance Detection',
      status: 'FAIL',
      message: 'No STX balance found in results',
      data: { 
        allKeys: Object.keys(rawBalances).slice(0, 10),
        allContractIds: Object.values(rawBalances).map((b: any) => b.contractId).slice(0, 10)
      }
    });
  }
  
  // Check for non-zero balances
  const nonZeroBalances = Object.entries(rawBalances).filter(([, data]) => 
    Number(data.balance || 0) > 0
  );
  
  logResult({
    test: 'Non-Zero Balance Analysis',
    status: nonZeroBalances.length > 0 ? 'PASS' : 'FAIL',
    message: `Found ${nonZeroBalances.length} non-zero balances out of ${Object.keys(rawBalances).length} total`,
    data: {
      nonZeroCount: nonZeroBalances.length,
      totalCount: Object.keys(rawBalances).length,
      topBalances: nonZeroBalances
        .sort(([, a], [, b]) => Number(b.balance) - Number(a.balance))
        .slice(0, 5)
        .map(([key, data]) => ({
          key,
          contractId: data.contractId,
          balance: data.balance,
          symbol: tokenRecords.get(data.contractId)?.symbol || 'Unknown'
        }))
    }
  });
  
  // Check balance data structure
  const sampleBalance = Object.values(rawBalances)[0] as any;
  if (sampleBalance) {
    const hasRequiredFields = !!(
      sampleBalance.userId &&
      sampleBalance.contractId &&
      sampleBalance.balance !== undefined
    );
    
    logResult({
      test: 'Balance Data Structure',
      status: hasRequiredFields ? 'PASS' : 'FAIL',
      message: `Required fields present: ${hasRequiredFields}`,
      data: {
        sampleStructure: {
          userId: sampleBalance.userId,
          contractId: sampleBalance.contractId,
          balance: sampleBalance.balance,
          totalSent: sampleBalance.totalSent,
          totalReceived: sampleBalance.totalReceived,
          timestamp: sampleBalance.timestamp,
          source: sampleBalance.source
        }
      }
    });
  }
  
  // Check token mapping consistency
  const contractIds = new Set(Object.values(rawBalances).map((b: any) => b.contractId));
  const mappedTokens = Array.from(contractIds).filter(id => tokenRecords.has(id)).length;
  const unmappedTokens = Array.from(contractIds).filter(id => !tokenRecords.has(id));
  
  logResult({
    test: 'Token Mapping Consistency',
    status: unmappedTokens.length === 0 ? 'PASS' : 'FAIL',
    message: `${mappedTokens}/${contractIds.size} tokens have metadata mapping`,
    data: {
      mappedCount: mappedTokens,
      totalCount: contractIds.size,
      unmappedTokens: unmappedTokens.slice(0, 5)
    }
  });
}

async function testMultipleUserBalanceFetching(tokenRecords: Map<string, any>) {
  log('Testing balance fetching for multiple users...');
  
  const testUsers = [
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    'SP3D6PV2ACBPEKYJTCMH7HEN02KP87QSP8KTEH335' // Another test user
  ];
  
  try {
    const start = Date.now();
    const rawBalances = await fetchUserBalances(testUsers, tokenRecords);
    const duration = Date.now() - start;
    
    const balanceCount = Object.keys(rawBalances).length;
    const user1Balances = Object.keys(rawBalances).filter(key => 
      Object.values(rawBalances)[Object.keys(rawBalances).indexOf(key)].userId === testUsers[0]
    ).length;
    const user2Balances = Object.keys(rawBalances).filter(key => 
      Object.values(rawBalances)[Object.keys(rawBalances).indexOf(key)].userId === testUsers[1]
    ).length;
    
    logResult({
      test: 'Multiple User Balance Fetch',
      status: 'PASS',
      message: `Retrieved ${balanceCount} total balance entries for ${testUsers.length} users`,
      duration,
      data: {
        totalBalances: balanceCount,
        userCount: testUsers.length,
        user1Balances,
        user2Balances
      }
    });
    
    return rawBalances;
    
  } catch (error) {
    logResult({
      test: 'Multiple User Balance Fetch',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function testProductionSpecificScenarios(tokenRecords: Map<string, any>) {
  log('Testing production-specific scenarios...');
  
  // Test with production environment variables
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  
  try {
    const userId = DEFAULT_TEST_USER;
    const rawBalances = await fetchUserBalances([userId], tokenRecords);
    
    logResult({
      test: 'Production Environment Balance Fetch',
      status: 'PASS',
      message: `Retrieved ${Object.keys(rawBalances).length} balances in production mode`,
      data: { count: Object.keys(rawBalances).length }
    });
    
  } catch (error) {
    logResult({
      test: 'Production Environment Balance Fetch',
      status: 'FAIL',
      message: `Error in production mode: ${error instanceof Error ? error.message : String(error)}`
    });
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
}

async function compareWithExpectedResults(rawBalances: Record<string, any> | null) {
  if (!rawBalances) return;
  
  log('Comparing with expected results from deep analysis...');
  
  const expectedBalanceCount = 405; // From deep analysis
  const expectedStxBalance = 4051697964; // From deep analysis
  const actualBalanceCount = Object.keys(rawBalances).length;
  
  // Find STX balance
  const stxEntry = Object.entries(rawBalances).find(([, data]) => 
    data.contractId === '.stx'
  );
  const actualStxBalance = stxEntry ? Number(stxEntry[1].balance) : 0;
  
  logResult({
    test: 'Expected Balance Count',
    status: actualBalanceCount >= expectedBalanceCount * 0.9 ? 'PASS' : 'FAIL', // Allow 10% tolerance
    message: `Expected ~${expectedBalanceCount}, got ${actualBalanceCount}`,
    data: {
      expected: expectedBalanceCount,
      actual: actualBalanceCount,
      ratio: (actualBalanceCount / expectedBalanceCount * 100).toFixed(1) + '%'
    }
  });
  
  logResult({
    test: 'Expected STX Balance',
    status: actualStxBalance === expectedStxBalance ? 'PASS' : 'FAIL',
    message: `Expected ${expectedStxBalance}, got ${actualStxBalance}`,
    data: {
      expected: expectedStxBalance,
      actual: actualStxBalance,
      difference: Math.abs(actualStxBalance - expectedStxBalance)
    }
  });
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 PRODUCTION BALANCE TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`📋 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n🔍 Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(result => {
      console.log(`   ❌ ${result.test}: ${result.message}`);
    });
  }
  
  const successRate = results.length > 0 ? ((passed / results.length) * 100).toFixed(1) : '0.0';
  console.log(`\n🎯 Success Rate: ${successRate}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All balance tests passed! Balance fetching is working correctly.');
    console.log('   The issue may be in the BalancesParty caching or HTTP endpoint logic.');
  } else {
    console.log('\n⚠️ Some balance tests failed. This explains the production balance discrepancies.');
  }
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  const userId = process.argv[2] || DEFAULT_TEST_USER;
  
  console.log('🔬 PRODUCTION BALANCE FETCHING TEST');
  console.log('='.repeat(80));
  console.log(`👤 Test User: ${userId.slice(0, 8)}...${userId.slice(-4)}`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(80));
  
  try {
    // Test token metadata loading first
    const tokenRecords = await testTokenMetadataPrerequisite();
    if (!tokenRecords) {
      console.error('❌ Cannot proceed without token metadata');
      process.exit(1);
    }
    
    // Test single user balance fetching
    const rawBalances = await testSingleUserBalanceFetching(userId, tokenRecords);
    
    // Test multiple user balance fetching
    await testMultipleUserBalanceFetching(tokenRecords);
    
    // Test production-specific scenarios
    await testProductionSpecificScenarios(tokenRecords);
    
    // Compare with expected results
    await compareWithExpectedResults(rawBalances);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    printSummary();
  }
}

// Run the tests
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});