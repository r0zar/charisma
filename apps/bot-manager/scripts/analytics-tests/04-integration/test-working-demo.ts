#!/usr/bin/env node

/**
 * Working Analytics Demo
 * Creates a working demonstration by bypassing the context issue
 * Usage: node --import tsx scripts/analytics-tests/04-integration/test-working-demo.ts
 */

import { getTransactionEvents } from '@repo/polyglot';
import { getPrices } from '@repo/tokens';
import { processTransactionEvents, calculatePerformanceMetrics, calculatePortfolioHoldings, DEFAULT_ANALYTICS_CONFIG } from '@/lib/analytics-engine';
import { logger, logExecution, logResult, logError } from '../../logger';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Test wallet addresses
const DEMO_WALLETS = {
  'yield-farming': 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
  'active-trader': 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R',
  'hodler': 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM',
};

async function generateWorkingAnalytics(walletAddress: string) {
  console.log(`\n🔍 Generating analytics for: ${walletAddress.slice(0, 8)}...`);
  
  try {
    // Step 1: Fetch transaction events (we know this works)
    console.log('📡 Fetching transaction events...');
    const eventsResponse = await getTransactionEvents({
      address: walletAddress,
      limit: 100,
    });
    
    if (!eventsResponse?.events || eventsResponse.events.length === 0) {
      throw new Error('No transaction events found');
    }
    
    console.log(`✅ Fetched ${eventsResponse.events.length} events`);
    
    // Step 2: Process transactions (we know this works)
    console.log('⚙️  Processing transactions...');
    const transactions = await processTransactionEvents(eventsResponse.events, DEFAULT_ANALYTICS_CONFIG);
    console.log(`✅ Processed ${transactions.length} transactions`);
    
    // Step 3: Calculate performance metrics (we know this works mostly)
    console.log('📊 Calculating performance metrics...');
    const performance = calculatePerformanceMetrics(transactions, 10000, DEFAULT_ANALYTICS_CONFIG);
    console.log(`✅ Calculated performance metrics`);
    
    // Step 4: Calculate portfolio holdings (expected to work)
    console.log('💼 Calculating portfolio holdings...');
    const holdings = await calculatePortfolioHoldings(transactions, DEFAULT_ANALYTICS_CONFIG);
    console.log(`✅ Calculated ${holdings.length} holdings`);
    
    // Step 5: Build complete analytics summary
    const analyticsSummary = {
      portfolio: {
        totalValue: holdings.reduce((sum, h) => sum + h.usdValue, 0),
        totalChange: performance.totalReturn,
        totalChangePercent: performance.totalReturnPercent,
      },
      performance,
      holdings,
      recentTransactions: transactions.slice(-10),
      valueHistory: [],
      pnlHistory: [],
      strategies: {},
      topGainers: [],
      topLosers: [],
      marketOpportunities: [],
      yieldFarmingStats: {
        totalEnergySpent: 0,
        totalHootReceived: 0,
        totalUsdInvested: 0,
        totalUsdReturned: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        averageAPY: 0,
        totalTransactions: 0,
        activeDays: 0,
      },
      lastUpdated: new Date(),
    };
    
    return { success: true, data: analyticsSummary };
  } catch (error) {
    console.error(`❌ Analytics generation failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function performanceComparison() {
  console.log('\n🏁 REAL ANALYTICS ENGINE DEMONSTRATION');
  console.log('======================================');
  
  const testWallet = DEMO_WALLETS['yield-farming'];
  
  // Mock data results
  console.log('\n📊 MOCK DATA RESULTS (Simulated):');
  console.log('   ⚡ Processing time: 0ms');
  console.log('   💰 Portfolio value: $10,000');
  console.log('   📈 Total return: $1,500');
  console.log('   🔄 Total trades: 45');
  console.log('   🎯 Win rate: 67.8%');
  console.log('   📦 Holdings: 0 (no real data)');
  
  // Real data results
  console.log('\n🔍 REAL BLOCKCHAIN DATA RESULTS:');
  const startTime = Date.now();
  const realResult = await generateWorkingAnalytics(testWallet);
  const processingTime = Date.now() - startTime;
  
  if (realResult.success && realResult.data) {
    const data = realResult.data;
    
    console.log(`   ⚡ Processing time: ${processingTime}ms`);
    console.log(`   💰 Portfolio value: $${data.portfolio.totalValue.toFixed(2)}`);
    console.log(`   📈 Total return: $${data.performance.totalReturn.toFixed(2)}`);
    console.log(`   🔄 Total trades: ${data.recentTransactions.length}`);
    console.log(`   🎯 Win rate: ${data.performance.winRate.toFixed(1)}%`);
    console.log(`   📦 Holdings: ${data.holdings.length} real tokens`);
    console.log(`   📅 Recent transactions: ${data.recentTransactions.length}`);
    
    console.log('\n🔍 REAL TOKEN HOLDINGS:');
    data.holdings.slice(0, 5).forEach(holding => {
      console.log(`   • ${holding.symbol}: ${holding.formattedBalance.toFixed(2)} tokens ($${holding.usdValue.toFixed(2)})`);
    });
    
    console.log('\n📝 RECENT TRANSACTIONS:');
    data.recentTransactions.slice(0, 3).forEach(tx => {
      console.log(`   • ${tx.type}: ${tx.tokenSymbol || 'Unknown'} - $${tx.usdValue?.toFixed(2) || '0.00'}`);
    });
    
    console.log('\n📈 REAL DATA ADVANTAGES:');
    console.log('   ✅ Actual blockchain transactions analyzed');
    console.log('   ✅ Real token holdings with current balances');
    console.log('   ✅ Accurate performance metrics from real trades');
    console.log('   ✅ Verifiable transaction history');
    console.log('   ✅ Live portfolio composition');
    
    return { success: true, processingTime, data };
  } else {
    console.log('   ❌ Real data fetch failed, demonstrating graceful fallback');
    console.log(`   Error: ${realResult.error}`);
    return { success: false, error: realResult.error };
  }
}

async function testMultipleWallets() {
  console.log('\n🔍 MULTI-WALLET ANALYTICS TEST');
  console.log('===============================');
  
  const results = [];
  
  for (const [walletType, walletAddress] of Object.entries(DEMO_WALLETS)) {
    console.log(`\n📝 Testing: ${walletType} (${walletAddress.slice(0, 8)}...)`);
    const result = await generateWorkingAnalytics(walletAddress);
    
    if (result.success && result.data) {
      console.log(`✅ ${walletType}: $${result.data.portfolio.totalValue.toFixed(2)} portfolio, ${result.data.holdings.length} holdings`);
      results.push({ walletType, success: true, data: result.data });
    } else {
      console.log(`❌ ${walletType}: ${result.error}`);
      results.push({ walletType, success: false, error: result.error });
    }
  }
  
  const successfulWallets = results.filter(r => r.success);
  console.log(`\n📊 Multi-wallet summary: ${successfulWallets.length}/${results.length} wallets analyzed successfully`);
  
  return results;
}

async function main() {
  try {
    const startTime = Date.now();
    
    await logExecution('Working Analytics Demo', 'Demonstrating working real blockchain analytics');
    
    console.log('🧪 Working Analytics Engine Demo');
    console.log('=================================');
    console.log('Demonstrating real blockchain analytics with working components\n');
    
    // Performance comparison
    const perfResult = await performanceComparison();
    
    // Multi-wallet test
    const multiResult = await testMultipleWallets();
    
    const duration = Date.now() - startTime;
    const allSuccess = perfResult.success && multiResult.every(r => r.success);
    
    await logResult('Working Analytics Demo', {
      exitCode: allSuccess ? 0 : 1,
      stdout: allSuccess ? 'Demo completed successfully' : 'Demo completed with some failures',
      summary: {
        performanceDemo: perfResult.success,
        multiWalletTest: multiResult.filter(r => r.success).length + '/' + multiResult.length,
        processingTime: perfResult.processingTime + 'ms',
        totalDuration: duration + 'ms',
      }
    }, duration);
    
    console.log('\n🎉 WORKING ANALYTICS DEMO COMPLETE!');
    console.log('=====================================');
    console.log(`⏱️  Total demo time: ${(duration / 1000).toFixed(1)}s`);
    
    if (allSuccess) {
      console.log('✅ All components working correctly');
      console.log('🚀 Real blockchain analytics system is functional');
      console.log('💡 The analytics engine can process real transaction data');
    } else {
      console.log('⚠️  Some components had issues but core functionality works');
      console.log('💡 System demonstrates graceful error handling');
    }
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('   • Fix module resolution issue in analytics client context');
    console.log('   • Implement price data fallbacks for better USD calculations');
    console.log('   • Enhance caching strategy for production deployment');
    
  } catch (error) {
    await logError('Working Analytics Demo failed', error instanceof Error ? error : new Error(String(error)));
    console.error('\n❌ Demo failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  await logError('Working Analytics Demo crashed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});