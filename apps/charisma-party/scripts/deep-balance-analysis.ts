#!/usr/bin/env tsx

/**
 * Deep Balance Analysis Script
 * Performs detailed comparison between production API and direct library calls
 * Focuses on identifying discrepancies and understanding data flow differences
 * 
 * Usage: pnpm script deep-balance-analysis [userId]
 * Example: pnpm script deep-balance-analysis SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
 */

import { fetchUserBalances, loadTokenMetadata } from '../src/balances-lib.js';

// Configuration
const PROD_HOST = 'https://charisma-party.r0zar.partykit.dev';
const DEFAULT_TEST_USER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

interface DetailedComparison {
  contractId: string;
  symbol: string;
  source: 'mainnet' | 'subnet' | 'unknown';
  prodData: {
    present: boolean;
    balance: string | number;
    formattedBalance?: string;
    metadata?: any;
  };
  directData: {
    present: boolean;
    balance: string | number;
    metadata?: any;
  };
  discrepancy: {
    hasDifference: boolean;
    type: 'value_mismatch' | 'missing_in_prod' | 'missing_in_direct' | 'both_zero' | 'match';
    significance: 'critical' | 'minor' | 'none';
    details?: string;
  };
}

async function fetchProductionData(userId: string) {
  console.log('🌐 Fetching production API data...');
  
  try {
    const response = await fetch(`${PROD_HOST}/parties/balances/main?users=${userId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Production API: ${data.balances?.length || 0} balance entries retrieved`);
    
    // Convert to Map for easier comparison
    const prodMap = new Map();
    if (data.balances) {
      data.balances.forEach((balance: any) => {
        prodMap.set(balance.contractId, {
          balance: balance.balance,
          formattedBalance: balance.formattedBalance,
          metadata: balance.metadata,
          symbol: balance.metadata?.symbol || balance.symbol,
          rawEntry: balance
        });
      });
    }
    
    return { rawResponse: data, balanceMap: prodMap };
    
  } catch (error) {
    console.error('❌ Production API error:', error);
    return null;
  }
}

async function fetchDirectLibraryData(userId: string) {
  console.log('📚 Fetching direct library data...');
  
  try {
    // Load token metadata like production does
    const tokenRecords = await loadTokenMetadata();
    console.log(`📋 Token metadata: ${tokenRecords.size} records loaded`);
    
    // Fetch user balances like production does
    const rawBalances = await fetchUserBalances([userId], tokenRecords);
    console.log(`✅ Direct library: ${Object.keys(rawBalances).length} balance entries retrieved`);
    
    // Convert to Map for easier comparison
    const directMap = new Map();
    Object.entries(rawBalances).forEach(([key, balanceData]: [string, any]) => {
      const contractId = balanceData.contractId;
      const tokenRecord = tokenRecords.get(contractId);
      
      directMap.set(contractId, {
        balance: balanceData.balance,
        metadata: tokenRecord,
        symbol: tokenRecord?.symbol || 'Unknown',
        rawEntry: balanceData,
        key: key
      });
    });
    
    return { 
      rawBalances, 
      tokenRecords, 
      balanceMap: directMap 
    };
    
  } catch (error) {
    console.error('❌ Direct library error:', error);
    return null;
  }
}

function analyzeDiscrepancies(prodMap: Map<string, any>, directMap: Map<string, any>): DetailedComparison[] {
  console.log('🔍 Performing deep discrepancy analysis...');
  
  const comparisons: DetailedComparison[] = [];
  const allContractIds = new Set([...prodMap.keys(), ...directMap.keys()]);
  
  let criticalDiscrepancies = 0;
  let minorDiscrepancies = 0;
  let perfectMatches = 0;
  
  allContractIds.forEach(contractId => {
    const prodEntry = prodMap.get(contractId);
    const directEntry = directMap.get(contractId);
    
    const comparison: DetailedComparison = {
      contractId,
      symbol: prodEntry?.symbol || directEntry?.symbol || 'Unknown',
      source: (directEntry?.metadata?.type === 'SUBNET') ? 'subnet' : 
              (contractId === '.stx' || directEntry?.metadata?.type === 'MAINNET') ? 'mainnet' : 'unknown',
      prodData: {
        present: !!prodEntry,
        balance: prodEntry?.balance || 0,
        formattedBalance: prodEntry?.formattedBalance,
        metadata: prodEntry?.metadata
      },
      directData: {
        present: !!directEntry,
        balance: directEntry?.balance || 0,
        metadata: directEntry?.metadata
      },
      discrepancy: {
        hasDifference: false,
        type: 'match',
        significance: 'none'
      }
    };
    
    // Analyze discrepancy
    if (!prodEntry && !directEntry) {
      // Should not happen, but handle it
      comparison.discrepancy = {
        hasDifference: false,
        type: 'match',
        significance: 'none'
      };
    } else if (!prodEntry && directEntry) {
      comparison.discrepancy = {
        hasDifference: true,
        type: 'missing_in_prod',
        significance: Number(directEntry.balance) > 0 ? 'critical' : 'minor',
        details: `Balance ${directEntry.balance} only in direct library`
      };
      if (Number(directEntry.balance) > 0) criticalDiscrepancies++;
      else minorDiscrepancies++;
    } else if (prodEntry && !directEntry) {
      comparison.discrepancy = {
        hasDifference: true,
        type: 'missing_in_direct',
        significance: Number(prodEntry.balance) > 0 ? 'critical' : 'minor',
        details: `Balance ${prodEntry.balance} only in production API`
      };
      if (Number(prodEntry.balance) > 0) criticalDiscrepancies++;
      else minorDiscrepancies++;
    } else {
      // Both present, compare values
      const prodBalance = Number(prodEntry.balance || 0);
      const directBalance = Number(directEntry.balance || 0);
      
      if (prodBalance === directBalance) {
        if (prodBalance === 0) {
          comparison.discrepancy = {
            hasDifference: false,
            type: 'both_zero',
            significance: 'none'
          };
        } else {
          comparison.discrepancy = {
            hasDifference: false,
            type: 'match',
            significance: 'none'
          };
          perfectMatches++;
        }
      } else {
        comparison.discrepancy = {
          hasDifference: true,
          type: 'value_mismatch',
          significance: (prodBalance > 0 || directBalance > 0) ? 'critical' : 'minor',
          details: `Production: ${prodBalance}, Direct: ${directBalance}, Diff: ${Math.abs(prodBalance - directBalance)}`
        };
        if (prodBalance > 0 || directBalance > 0) criticalDiscrepancies++;
        else minorDiscrepancies++;
      }
    }
    
    comparisons.push(comparison);
  });
  
  console.log(`📊 Analysis complete: ${criticalDiscrepancies} critical, ${minorDiscrepancies} minor discrepancies, ${perfectMatches} perfect matches`);
  
  return comparisons;
}

function printDetailedResults(comparisons: DetailedComparison[], userId: string) {
  console.log('\n' + '='.repeat(100));
  console.log('🔬 DEEP BALANCE ANALYSIS RESULTS');
  console.log('='.repeat(100));
  console.log(`👤 User: ${userId.slice(0, 12)}...${userId.slice(-8)}`);
  console.log(`📋 Total Tokens Analyzed: ${comparisons.length}`);
  
  // Critical discrepancies first
  const critical = comparisons.filter(c => c.discrepancy.significance === 'critical');
  if (critical.length > 0) {
    console.log(`\n🚨 CRITICAL DISCREPANCIES (${critical.length})`);
    console.log('='.repeat(100));
    console.log('Symbol'.padEnd(15) + 'Contract ID'.padEnd(45) + 'Production'.padEnd(15) + 'Direct'.padEnd(15) + 'Issue');
    console.log('-'.repeat(100));
    
    critical.forEach(comp => {
      const symbol = comp.symbol.slice(0, 14).padEnd(15);
      const contractId = comp.contractId.slice(-44).padEnd(45);
      const prod = String(comp.prodData.balance).slice(0, 14).padEnd(15);
      const direct = String(comp.directData.balance).slice(0, 14).padEnd(15);
      const issue = comp.discrepancy.type;
      
      console.log(`${symbol}${contractId}${prod}${direct}${issue}`);
      if (comp.discrepancy.details) {
        console.log(`    💡 ${comp.discrepancy.details}`);
      }
    });
  }
  
  // Source analysis
  const mainnetTokens = comparisons.filter(c => c.source === 'mainnet');
  const subnetTokens = comparisons.filter(c => c.source === 'subnet');
  const unknownTokens = comparisons.filter(c => c.source === 'unknown');
  
  console.log(`\n📊 SOURCE BREAKDOWN`);
  console.log(`🌐 Mainnet Tokens: ${mainnetTokens.length}`);
  console.log(`🏗️ Subnet Tokens: ${subnetTokens.length}`);
  console.log(`❓ Unknown Source: ${unknownTokens.length}`);
  
  // Show mainnet critical issues
  const mainnetCritical = mainnetTokens.filter(c => c.discrepancy.significance === 'critical');
  if (mainnetCritical.length > 0) {
    console.log(`\n🌐 MAINNET CRITICAL ISSUES (${mainnetCritical.length})`);
    mainnetCritical.forEach(comp => {
      console.log(`   ${comp.symbol}: ${comp.discrepancy.details}`);
    });
  }
  
  // Show subnet critical issues
  const subnetCritical = subnetTokens.filter(c => c.discrepancy.significance === 'critical');
  if (subnetCritical.length > 0) {
    console.log(`\n🏗️ SUBNET CRITICAL ISSUES (${subnetCritical.length})`);
    subnetCritical.forEach(comp => {
      console.log(`   ${comp.symbol}: ${comp.discrepancy.details}`);
    });
  }
  
  // Show production-only tokens (might indicate filtering differences)
  const prodOnly = comparisons.filter(c => c.discrepancy.type === 'missing_in_direct');
  if (prodOnly.length > 0) {
    console.log(`\n🌐 PRODUCTION-ONLY TOKENS (${prodOnly.length})`);
    console.log('These tokens appear in production API but not in direct library calls:');
    prodOnly.slice(0, 10).forEach(comp => {
      const contractDisplay = comp.contractId ? comp.contractId.slice(-20) : 'Unknown';
      console.log(`   ${comp.symbol} (${contractDisplay}): ${comp.prodData.balance}`);
    });
    if (prodOnly.length > 10) {
      console.log(`   ... and ${prodOnly.length - 10} more`);
    }
  }
  
  // Show direct-only tokens (might indicate data source differences)
  const directOnly = comparisons.filter(c => c.discrepancy.type === 'missing_in_prod');
  if (directOnly.length > 0) {
    console.log(`\n📚 DIRECT-LIBRARY-ONLY TOKENS (${directOnly.length})`);
    console.log('These tokens appear in direct library but not in production API:');
    directOnly.slice(0, 10).forEach(comp => {
      console.log(`   ${comp.symbol} (${comp.contractId.slice(-20)}): ${comp.directData.balance}`);
    });
    if (directOnly.length > 10) {
      console.log(`   ... and ${directOnly.length - 10} more`);
    }
  }
  
  // Perfect matches
  const matches = comparisons.filter(c => !c.discrepancy.hasDifference && c.discrepancy.type === 'match');
  console.log(`\n✅ PERFECT MATCHES: ${matches.length} tokens with identical non-zero balances`);
  
  // Zero matches
  const zeroMatches = comparisons.filter(c => !c.discrepancy.hasDifference && c.discrepancy.type === 'both_zero');
  console.log(`⭕ ZERO MATCHES: ${zeroMatches.length} tokens with matching zero balances`);
}

function generateRecommendations(comparisons: DetailedComparison[]) {
  console.log('\n' + '='.repeat(100));
  console.log('💡 RECOMMENDATIONS & NEXT STEPS');
  console.log('='.repeat(100));
  
  const critical = comparisons.filter(c => c.discrepancy.significance === 'critical');
  const missingInProd = comparisons.filter(c => c.discrepancy.type === 'missing_in_prod' && Number(c.directData.balance) > 0);
  const valueMismatches = comparisons.filter(c => c.discrepancy.type === 'value_mismatch' && c.discrepancy.significance === 'critical');
  
  if (critical.length === 0) {
    console.log('🎉 No critical issues found! Production API and direct library are in sync.');
    return;
  }
  
  console.log(`⚠️  Found ${critical.length} critical discrepancies that need investigation:`);
  
  if (missingInProd.length > 0) {
    console.log(`\n1. MISSING DATA IN PRODUCTION (${missingInProd.length} tokens)`);
    console.log('   📝 Action: Check if production BalancesParty is using same data sources as direct library');
    console.log('   🔍 Focus: Token metadata loading and balance fetching logic');
    console.log('   🎯 Key tokens to investigate:');
    missingInProd.slice(0, 5).forEach(comp => {
      console.log(`      - ${comp.symbol}: ${comp.directData.balance} (missing in prod)`);
    });
  }
  
  if (valueMismatches.length > 0) {
    console.log(`\n2. VALUE MISMATCHES (${valueMismatches.length} tokens)`);
    console.log('   📝 Action: Compare data transformation logic between production and direct calls');
    console.log('   🔍 Focus: Balance calculation, formatting, and number precision');
    console.log('   🎯 Key mismatches:');
    valueMismatches.slice(0, 5).forEach(comp => {
      console.log(`      - ${comp.symbol}: ${comp.discrepancy.details}`);
    });
  }
  
  console.log(`\n🔧 DEBUGGING STEPS:`);
  console.log('   1. Check production BalancesParty logs for errors during balance fetching');
  console.log('   2. Compare token metadata loading between prod and direct library');
  console.log('   3. Verify API endpoint filtering logic vs direct library filtering');
  console.log('   4. Test with different user IDs to see if issue is user-specific');
  console.log('   5. Check if production cache is stale or missing data');
}

async function main() {
  const userId = process.argv[2] || DEFAULT_TEST_USER;
  
  console.log('🔬 DEEP BALANCE ANALYSIS: Production vs Direct Library');
  console.log('='.repeat(100));
  console.log(`👤 Analyzing User: ${userId}`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(100));
  
  try {
    // Fetch data from both sources
    const [prodResult, directResult] = await Promise.all([
      fetchProductionData(userId),
      fetchDirectLibraryData(userId)
    ]);
    
    if (!prodResult || !directResult) {
      console.error('❌ Failed to fetch data from one or both sources');
      process.exit(1);
    }
    
    console.log(`\n📊 DATA SUMMARY:`);
    console.log(`   Production API: ${prodResult.balanceMap.size} tokens`);
    console.log(`   Direct Library: ${directResult.balanceMap.size} tokens`);
    console.log(`   Token Metadata: ${directResult.tokenRecords.size} records`);
    
    // Perform detailed analysis
    const comparisons = analyzeDiscrepancies(prodResult.balanceMap, directResult.balanceMap);
    
    // Show detailed results
    printDetailedResults(comparisons, userId);
    
    // Generate actionable recommendations
    generateRecommendations(comparisons);
    
  } catch (error) {
    console.error('❌ Deep analysis failed:', error);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(100));
  console.log(`✅ Deep analysis complete at ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(100));
}

// Run the analysis
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});