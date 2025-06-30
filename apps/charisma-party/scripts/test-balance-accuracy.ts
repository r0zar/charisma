#!/usr/bin/env tsx

/**
 * Test script to compare production API balances with direct balances-lib calls
 * Verifies that the deployed BalancesParty returns the same data as the source code
 * 
 * Usage: pnpm script test-balance-accuracy [userId]
 * Example: pnpm script test-balance-accuracy SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
 */

import { fetchUserBalances, loadTokenMetadata } from '../src/balances-lib.js';

// Configuration
const PROD_HOST = 'https://charisma-party.r0zar.partykit.dev';
const DEFAULT_TEST_USER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'; // Known user from logs with balances

interface BalanceComparison {
  contractId: string;
  symbol: string;
  prodBalance: number;
  libBalance: number;
  match: boolean;
  difference?: number;
  source: 'mainnet' | 'subnet';
}

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
  data?: any;
}

const results: TestResult[] = [];
const comparisons: BalanceComparison[] = [];

function log(message: string) {
  console.log(`🧪 ${message}`);
}

function logResult(result: TestResult) {
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  console.log(`${emoji} ${result.test}${duration}: ${result.message}`);
  results.push(result);
}

async function fetchProductionBalances(userId: string) {
  log('Fetching balances from production API...');
  
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/balances/main?users=${userId}`);
    const duration = Date.now() - start;
    
    if (!response.ok) {
      logResult({
        test: 'Production API Request',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
      return null;
    }
    
    const data = await response.json();
    
    logResult({
      test: 'Production API Request',
      status: 'PASS',
      message: `Retrieved ${data.balances?.length || 0} balance entries`,
      duration
    });
    
    return data.balances || [];
    
  } catch (error) {
    logResult({
      test: 'Production API Request',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function fetchDirectBalances(userId: string) {
  log('Fetching balances using direct balances-lib calls...');
  
  try {
    const start = Date.now();
    
    // Load token metadata like the production server does
    const tokenRecords = await loadTokenMetadata();
    
    // Fetch user balances like the production server does
    const rawBalances = await fetchUserBalances([userId], tokenRecords);
    
    const duration = Date.now() - start;
    
    logResult({
      test: 'Direct balances-lib Call',
      status: 'PASS',
      message: `Retrieved ${Object.keys(rawBalances).length} raw balance entries using ${tokenRecords.size} token records`,
      duration
    });
    
    return { rawBalances, tokenRecords };
    
  } catch (error) {
    logResult({
      test: 'Direct balances-lib Call',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

function normalizeProductionBalances(prodBalances: any[]) {
  const normalized = new Map<string, { balance: number; symbol: string; source: 'mainnet' | 'subnet' }>();
  
  prodBalances.forEach(balance => {
    const contractId = balance.contractId;
    const symbol = balance.metadata?.symbol || balance.symbol || 'Unknown';
    const isSubnet = balance.metadata?.type === 'SUBNET';
    
    normalized.set(contractId, {
      balance: Number(balance.balance || 0),
      symbol,
      source: isSubnet ? 'subnet' : 'mainnet'
    });
  });
  
  return normalized;
}

function normalizeDirectBalances(rawBalances: Record<string, any>, tokenRecords: Map<string, any>) {
  const normalized = new Map<string, { balance: number; symbol: string; source: 'mainnet' | 'subnet' }>();
  
  Object.entries(rawBalances).forEach(([key, balanceData]) => {
    const contractId = balanceData.contractId;
    const tokenRecord = tokenRecords.get(contractId);
    const symbol = tokenRecord?.symbol || 'Unknown';
    const isSubnet = tokenRecord?.type === 'SUBNET';
    
    normalized.set(contractId, {
      balance: Number(balanceData.balance || 0),
      symbol,
      source: isSubnet ? 'subnet' : 'mainnet'
    });
  });
  
  return normalized;
}

function compareBalances(prodBalances: Map<string, any>, directBalances: Map<string, any>) {
  log('Comparing production vs direct balance results...');
  
  const allContractIds = new Set([...prodBalances.keys(), ...directBalances.keys()]);
  let exactMatches = 0;
  let totalComparisons = 0;
  
  allContractIds.forEach(contractId => {
    const prod = prodBalances.get(contractId);
    const direct = directBalances.get(contractId);
    
    if (prod && direct) {
      totalComparisons++;
      const match = prod.balance === direct.balance;
      if (match) exactMatches++;
      
      const comparison: BalanceComparison = {
        contractId,
        symbol: prod.symbol || direct.symbol,
        prodBalance: prod.balance,
        libBalance: direct.balance,
        match,
        difference: match ? undefined : Math.abs(prod.balance - direct.balance),
        source: prod.source || direct.source
      };
      
      comparisons.push(comparison);
      
      // Log significant differences
      if (!match && (prod.balance > 0 || direct.balance > 0)) {
        console.log(`   ⚠️  ${comparison.symbol} (${contractId.slice(-15)}): prod=${prod.balance}, direct=${direct.balance}`);
      }
    } else if (prod && !direct) {
      console.log(`   📊 ${prod.symbol}: Only in production (${prod.balance})`);
    } else if (!prod && direct) {
      console.log(`   📊 ${direct.symbol}: Only in direct call (${direct.balance})`);
    }
  });
  
  logResult({
    test: 'Balance Comparison',
    status: exactMatches === totalComparisons ? 'PASS' : 'FAIL',
    message: `${exactMatches}/${totalComparisons} balances match exactly`,
    data: { exactMatches, totalComparisons, allContractIds: allContractIds.size }
  });
  
  return { exactMatches, totalComparisons };
}

function printDetailedResults(userId: string) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DETAILED BALANCE COMPARISON RESULTS');
  console.log('='.repeat(80));
  console.log(`👤 User: ${userId.slice(0, 8)}...${userId.slice(-4)}`);
  console.log(`📋 Total Comparisons: ${comparisons.length}`);
  
  // Group by source
  const mainnetComparisons = comparisons.filter(c => c.source === 'mainnet');
  const subnetComparisons = comparisons.filter(c => c.source === 'subnet');
  
  console.log(`🌐 Mainnet Tokens: ${mainnetComparisons.length}`);
  console.log(`🏗️ Subnet Tokens: ${subnetComparisons.length}`);
  
  // Show non-zero balances
  const nonZeroComparisons = comparisons.filter(c => c.prodBalance > 0 || c.libBalance > 0);
  console.log(`💰 Non-zero Balances: ${nonZeroComparisons.length}`);
  
  if (nonZeroComparisons.length > 0) {
    console.log('\n🔍 NON-ZERO BALANCE DETAILS:');
    console.log('-'.repeat(80));
    console.log('Symbol'.padEnd(12) + 'Source'.padEnd(8) + 'Production'.padEnd(15) + 'Direct'.padEnd(15) + 'Match');
    console.log('-'.repeat(80));
    
    nonZeroComparisons
      .sort((a, b) => (b.prodBalance + b.libBalance) - (a.prodBalance + a.libBalance))
      .slice(0, 20) // Show top 20
      .forEach(comp => {
        const symbol = comp.symbol.slice(0, 11).padEnd(12);
        const source = comp.source.padEnd(8);
        const prod = comp.prodBalance.toString().padEnd(15);
        const lib = comp.libBalance.toString().padEnd(15);
        const match = comp.match ? '✅' : '❌';
        
        console.log(`${symbol}${source}${prod}${lib}${match}`);
      });
    
    if (nonZeroComparisons.length > 20) {
      console.log(`... and ${nonZeroComparisons.length - 20} more non-zero balances`);
    }
  }
  
  // Show mismatches
  const mismatches = comparisons.filter(c => !c.match && (c.prodBalance > 0 || c.libBalance > 0));
  if (mismatches.length > 0) {
    console.log('\n❌ BALANCE MISMATCHES:');
    console.log('-'.repeat(50));
    mismatches.forEach(comp => {
      console.log(`${comp.symbol}: prod=${comp.prodBalance}, direct=${comp.libBalance} (diff: ${comp.difference})`);
    });
  }
  
  // Show some examples of zero balances to confirm they're being compared
  const zeroComparisons = comparisons.filter(c => c.prodBalance === 0 && c.libBalance === 0);
  if (zeroComparisons.length > 0) {
    console.log(`\n⭕ Zero Balance Matches: ${zeroComparisons.length} tokens (showing sample)`);
    zeroComparisons.slice(0, 5).forEach(comp => {
      console.log(`   ${comp.symbol} [${comp.source}]: both 0 ✅`);
    });
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
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
  
  // Balance accuracy summary
  const exactMatches = comparisons.filter(c => c.match).length;
  const totalComparisons = comparisons.length;
  const balanceAccuracy = totalComparisons > 0 ? ((exactMatches / totalComparisons) * 100).toFixed(1) : '0.0';
  
  console.log(`\n💰 Balance Accuracy: ${balanceAccuracy}% (${exactMatches}/${totalComparisons} exact matches)`);
  
  if (passed === results.length && results.length > 0 && balanceAccuracy === '100.0') {
    console.log('\n🎉 SUCCESS! Production API returns identical balances to direct balances-lib calls.');
    console.log('   ✨ The deployed BalancesParty is working correctly with the new architecture.');
  } else if (failed > 0 || balanceAccuracy !== '100.0') {
    console.log('\n⚠️  Some tests failed or balances don\'t match. Check the deployment.');
  }
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  const userId = process.argv[2] || DEFAULT_TEST_USER;
  
  console.log('🚀 Testing Balance Accuracy: Production API vs Direct balances-lib');
  console.log('='.repeat(80));
  console.log(`👤 Test User: ${userId.slice(0, 8)}...${userId.slice(-4)}`);
  console.log(`🌐 Production: ${PROD_HOST}`);
  console.log(`📚 Library: Local balances-lib.ts`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(80));
  
  try {
    // Fetch balances from both sources
    const [prodBalances, directResult] = await Promise.all([
      fetchProductionBalances(userId),
      fetchDirectBalances(userId)
    ]);
    
    if (!prodBalances || !directResult) {
      console.error('❌ Failed to fetch balances from one or both sources');
      process.exit(1);
    }
    
    const { rawBalances, tokenRecords } = directResult;
    
    // Normalize the data for comparison
    const normalizedProd = normalizeProductionBalances(prodBalances);
    const normalizedDirect = normalizeDirectBalances(rawBalances, tokenRecords);
    
    console.log(`\n📊 Data Summary:`);
    console.log(`   Production API: ${normalizedProd.size} balance entries`);
    console.log(`   Direct Library: ${normalizedDirect.size} balance entries`);
    console.log(`   Token Metadata: ${tokenRecords.size} token records loaded`);
    
    // Compare the results
    const { exactMatches, totalComparisons } = compareBalances(normalizedProd, normalizedDirect);
    
    // Print detailed results
    printDetailedResults(userId);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    printSummary();
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});