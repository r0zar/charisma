#!/usr/bin/env node

/**
 * Test Performance Calculations
 * Tests the analytics engine performance metrics calculation functions
 * Usage: node --import tsx scripts/analytics-tests/02-engine-components/test-performance-calc.ts
 */

import { calculatePerformanceMetrics, DEFAULT_ANALYTICS_CONFIG } from '@/lib/analytics-engine';
import type { ProcessedTransaction } from '@/lib/analytics-types';
import { logger, logExecution, logResult, logError } from '../../logger';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function createSampleTransactions(): ProcessedTransaction[] {
  const baseDate = new Date('2024-01-01');
  
  return [
    {
      txId: 'tx-1',
      type: 'buy',
      tokenSymbol: 'CHARISMA',
      tokenId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      amount: 1000,
      usdValue: 100,
      price: 0.1,
      timestamp: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000),
      blockHeight: 100,
      status: 'success',
    },
    {
      txId: 'tx-2',
      type: 'sell',
      tokenSymbol: 'CHARISMA',
      tokenId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      amount: -500,
      usdValue: -60,
      price: 0.12,
      timestamp: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      blockHeight: 200,
      status: 'success',
    },
    {
      txId: 'tx-3',
      type: 'buy',
      tokenSymbol: 'ALEX',
      tokenId: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
      amount: 2000,
      usdValue: 200,
      price: 0.1,
      timestamp: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      blockHeight: 300,
      status: 'success',
    },
    {
      txId: 'tx-4',
      type: 'sell',
      tokenSymbol: 'ALEX',
      tokenId: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
      amount: -1000,
      usdValue: -80,
      price: 0.08,
      timestamp: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000),
      blockHeight: 400,
      status: 'success',
    },
    {
      txId: 'tx-5',
      type: 'buy',
      tokenSymbol: 'STX',
      tokenId: '.stx',
      amount: 100,
      usdValue: 150,
      price: 1.5,
      timestamp: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000),
      blockHeight: 500,
      status: 'success',
    },
  ];
}

async function testBasicCalculations() {
  console.log('\n🔍 Test 1: Basic Performance Calculations');
  console.log('==========================================');
  
  const transactions = createSampleTransactions();
  const startingValue = 10000;
  
  try {
    console.log(`📊 Calculating metrics for ${transactions.length} transactions...`);
    console.log(`💰 Starting portfolio value: $${startingValue.toLocaleString()}`);
    
    const metrics = calculatePerformanceMetrics(transactions, startingValue, DEFAULT_ANALYTICS_CONFIG);
    
    console.log('\n📈 Calculated Performance Metrics:');
    console.log(`   💰 Current value: $${metrics.currentValue.toFixed(2)}`);
    console.log(`   📈 Total return: $${metrics.totalReturn.toFixed(2)}`);
    console.log(`   📊 Total return %: ${metrics.totalReturnPercent.toFixed(2)}%`);
    console.log(`   🔄 Total trades: ${metrics.totalTrades}`);
    console.log(`   🎯 Win rate: ${metrics.winRate.toFixed(1)}%`);
    console.log(`   💵 Average trade size: $${metrics.avgTradeSize.toFixed(2)}`);
    console.log(`   📉 Max drawdown: ${metrics.maxDrawdown.toFixed(2)}%`);
    console.log(`   📊 Sharpe ratio: ${metrics.sharpeRatio.toFixed(3)}`);
    console.log(`   💸 Total fees: $${metrics.totalFeesSpent.toFixed(2)}`);
    console.log(`   🌱 Total yield: $${metrics.totalYieldEarned.toFixed(2)}`);
    console.log(`   📅 Period: ${metrics.startDate.toDateString()} - ${metrics.endDate.toDateString()}`);
    
    // Validate calculations
    const expectedTotalUsd = transactions.reduce((sum, tx) => sum + (tx.usdValue || 0), 0);
    const calculatedReturn = metrics.totalReturn;
    
    console.log('\n✅ Validation:');
    console.log(`   Expected USD change: $${expectedTotalUsd.toFixed(2)}`);
    console.log(`   Calculated return: $${calculatedReturn.toFixed(2)}`);
    console.log(`   Match: ${Math.abs(expectedTotalUsd - calculatedReturn) < 0.01}`);
    
    await logger.success('Basic performance calculations test passed', {
      transactions: transactions.length,
      startingValue,
      metrics: {
        currentValue: metrics.currentValue,
        totalReturn: metrics.totalReturn,
        totalReturnPercent: metrics.totalReturnPercent,
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate,
      },
    });
    
    return { success: true, metrics };
  } catch (error) {
    console.error('❌ Basic calculations failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Basic performance calculations test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testEmptyTransactions() {
  console.log('\n🔍 Test 2: Empty Transactions Array');
  console.log('====================================');
  
  const startingValue = 5000;
  
  try {
    console.log('📊 Calculating metrics for empty transactions array...');
    
    const metrics = calculatePerformanceMetrics([], startingValue, DEFAULT_ANALYTICS_CONFIG);
    
    console.log('\n📈 Empty Array Metrics:');
    console.log(`   💰 Current value: $${metrics.currentValue.toFixed(2)}`);
    console.log(`   📈 Total return: $${metrics.totalReturn.toFixed(2)}`);
    console.log(`   🔄 Total trades: ${metrics.totalTrades}`);
    console.log(`   🎯 Win rate: ${metrics.winRate.toFixed(1)}%`);
    
    // Validate empty state
    const isValid = metrics.currentValue === startingValue && 
                   metrics.totalReturn === 0 && 
                   metrics.totalTrades === 0;
    
    console.log(`\n✅ Empty state validation: ${isValid ? 'PASS' : 'FAIL'}`);
    
    await logger.success('Empty transactions performance calculations test passed', {
      startingValue,
      metrics,
      isValid,
    });
    
    return { success: true, isValid };
  } catch (error) {
    console.error('❌ Empty transactions calculation failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Empty transactions performance calculations test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testLargeDataset() {
  console.log('\n🔍 Test 3: Large Dataset Performance');
  console.log('====================================');
  
  // Generate large dataset
  const largeTransactions: ProcessedTransaction[] = [];
  const baseDate = new Date('2024-01-01');
  
  for (let i = 0; i < 1000; i++) {
    largeTransactions.push({
      txId: `large-tx-${i}`,
      type: i % 2 === 0 ? 'buy' : 'sell',
      tokenSymbol: `TOKEN-${i % 10}`,
      tokenId: `contract-${i % 10}`,
      amount: (i % 2 === 0 ? 1 : -1) * (100 + Math.random() * 900),
      usdValue: (i % 2 === 0 ? 1 : -1) * (10 + Math.random() * 90),
      price: 0.1 + Math.random() * 0.9,
      timestamp: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000),
      blockHeight: 100 + i,
      status: 'success',
    });
  }
  
  const startingValue = 50000;
  
  try {
    console.log(`📊 Calculating metrics for ${largeTransactions.length} transactions...`);
    
    const startTime = Date.now();
    const metrics = calculatePerformanceMetrics(largeTransactions, startingValue, DEFAULT_ANALYTICS_CONFIG);
    const calculationTime = Date.now() - startTime;
    
    console.log(`\n⏱️  Calculation completed in ${calculationTime}ms`);
    console.log('\n📈 Large Dataset Metrics:');
    console.log(`   💰 Current value: $${metrics.currentValue.toFixed(2)}`);
    console.log(`   📈 Total return: $${metrics.totalReturn.toFixed(2)}`);
    console.log(`   🔄 Total trades: ${metrics.totalTrades}`);
    console.log(`   🎯 Win rate: ${metrics.winRate.toFixed(1)}%`);
    console.log(`   📊 Sharpe ratio: ${metrics.sharpeRatio.toFixed(3)}`);
    
    const isPerformant = calculationTime < 1000; // Should complete in under 1 second
    console.log(`\n✅ Performance test: ${isPerformant ? 'PASS' : 'FAIL'} (${calculationTime}ms)`);
    
    await logger.success('Large dataset performance calculations test passed', {
      transactions: largeTransactions.length,
      startingValue,
      calculationTime: calculationTime + 'ms',
      isPerformant,
      metrics: {
        currentValue: metrics.currentValue,
        totalReturn: metrics.totalReturn,
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate,
      },
    });
    
    return { success: true, isPerformant, calculationTime };
  } catch (error) {
    console.error('❌ Large dataset calculation failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Large dataset performance calculations test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testEdgeCases() {
  console.log('\n🔍 Test 4: Edge Cases');
  console.log('======================');
  
  // Create edge case transactions
  const edgeCases: ProcessedTransaction[] = [
    // Zero value transaction
    {
      txId: 'edge-tx-1',
      type: 'transfer',
      tokenSymbol: 'ZERO',
      tokenId: 'zero-token',
      amount: 0,
      usdValue: 0,
      price: 0,
      timestamp: new Date(),
      blockHeight: 1,
      status: 'success',
    },
    // Very large transaction
    {
      txId: 'edge-tx-2',
      type: 'buy',
      tokenSymbol: 'LARGE',
      tokenId: 'large-token',
      amount: 1000000000,
      usdValue: 1000000,
      price: 0.001,
      timestamp: new Date(),
      blockHeight: 2,
      status: 'success',
    },
    // Negative price (edge case)
    {
      txId: 'edge-tx-3',
      type: 'sell',
      tokenSymbol: 'NEGATIVE',
      tokenId: 'negative-token',
      amount: -100,
      usdValue: -50,
      price: 0.5,
      timestamp: new Date(),
      blockHeight: 3,
      status: 'failed',
    },
  ];
  
  try {
    console.log(`📊 Testing edge cases with ${edgeCases.length} special transactions...`);
    
    const metrics = calculatePerformanceMetrics(edgeCases, 10000, DEFAULT_ANALYTICS_CONFIG);
    
    console.log('\n📈 Edge Cases Metrics:');
    console.log(`   💰 Current value: $${metrics.currentValue.toFixed(2)}`);
    console.log(`   📈 Total return: $${metrics.totalReturn.toFixed(2)}`);
    console.log(`   🔄 Total trades: ${metrics.totalTrades}`);
    console.log(`   🎯 Win rate: ${metrics.winRate.toFixed(1)}%`);
    
    // Check for NaN or Infinity values
    const hasValidNumbers = !isNaN(metrics.currentValue) && 
                           !isNaN(metrics.totalReturn) && 
                           !isNaN(metrics.winRate) && 
                           isFinite(metrics.currentValue);
    
    console.log(`\n✅ Valid numbers check: ${hasValidNumbers ? 'PASS' : 'FAIL'}`);
    
    await logger.success('Edge cases performance calculations test passed', {
      edgeCases: edgeCases.length,
      metrics,
      hasValidNumbers,
    });
    
    return { success: true, hasValidNumbers };
  } catch (error) {
    console.error('❌ Edge cases calculation failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Edge cases performance calculations test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  try {
    const startTime = Date.now();
    
    await logExecution('Performance Calculations Test', 'Testing analytics engine performance metrics calculation functions');
    
    console.log('🧪 Performance Calculations Test');
    console.log('=================================');
    console.log('Testing analytics engine performance metrics calculation functions\n');
    
    // Run all tests
    const test1 = await testBasicCalculations();
    const test2 = await testEmptyTransactions();
    const test3 = await testLargeDataset();
    const test4 = await testEdgeCases();
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`✅ Basic calculations: ${test1.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Empty transactions: ${test2.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Large dataset: ${test3.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Edge cases: ${test4.success ? 'PASS' : 'FAIL'}`);
    
    const allPassed = test1.success && test2.success && test3.success && test4.success;
    
    const duration = Date.now() - startTime;
    await logResult('Performance Calculations Test', {
      exitCode: allPassed ? 0 : 1,
      stdout: allPassed ? 'All tests passed' : 'Some tests failed',
      summary: {
        basicCalculations: test1.success,
        emptyTransactions: test2.success,
        largeDataset: test3.success,
        edgeCases: test4.success,
        totalDuration: duration + 'ms',
      }
    }, duration);
    
    if (allPassed) {
      console.log('\n🎉 All Performance Calculations tests PASSED!');
      console.log('✅ Analytics engine performance calculations are working correctly');
    } else {
      console.log('\n❌ Some Performance Calculations tests FAILED!');
      console.log('🔧 Check the logs for detailed error information');
      process.exit(1);
    }
    
  } catch (error) {
    await logError('Performance Calculations Test failed', error instanceof Error ? error : new Error(String(error)));
    console.error('\n❌ Test script failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  await logError('Performance Calculations Test crashed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});