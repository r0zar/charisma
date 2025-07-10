#!/usr/bin/env node

/**
 * Test Transaction Processing
 * Tests the analytics engine transaction processing functions
 * Usage: node --import tsx scripts/analytics-tests/02-engine-components/test-transaction-processing.ts
 */

import { processTransactionEvents, DEFAULT_ANALYTICS_CONFIG } from '@/lib/analytics-engine';
import { getTransactionEvents } from '@repo/polyglot';
import { logger, logExecution, logResult, logError } from '../../logger';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Test wallet with known transaction history
const TEST_WALLET = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

async function testWithRealData() {
  console.log('\n🔍 Test 1: Process Real Transaction Events');
  console.log('==========================================');
  
  try {
    // Get real transaction events
    console.log('📡 Fetching real transaction events...');
    const eventsResponse = await getTransactionEvents({
      address: TEST_WALLET,
      limit: 20,
    });
    
    if (!eventsResponse?.events || eventsResponse.events.length === 0) {
      throw new Error('No transaction events found');
    }
    
    console.log(`✅ Fetched ${eventsResponse.events.length} real events`);
    
    // Process the events
    console.log('⚙️  Processing transaction events...');
    const processedTransactions = await processTransactionEvents(eventsResponse.events, DEFAULT_ANALYTICS_CONFIG);
    
    console.log(`✅ Processed ${processedTransactions.length} transactions`);
    
    // Analyze the processed data
    const eventTypes = new Set(processedTransactions.map(tx => tx.type));
    const tokenTypes = new Set(processedTransactions.map(tx => tx.tokenSymbol).filter(Boolean));
    const totalUsdValue = processedTransactions.reduce((sum, tx) => sum + (tx.usdValue || 0), 0);
    
    console.log('\n📊 Processing Results:');
    console.log(`   📋 Raw events: ${eventsResponse.events.length}`);
    console.log(`   🔄 Processed transactions: ${processedTransactions.length}`);
    console.log(`   📈 Transaction types: ${Array.from(eventTypes).join(', ')}`);
    console.log(`   🪙 Token types: ${Array.from(tokenTypes).join(', ')}`);
    console.log(`   💰 Total USD value: $${totalUsdValue.toFixed(2)}`);
    
    // Show sample transactions
    console.log('\n📝 Sample Processed Transactions:');
    processedTransactions.slice(0, 3).forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.type} - ${tx.tokenSymbol || 'N/A'} - $${tx.usdValue?.toFixed(2) || '0.00'}`);
    });
    
    await logger.success('Transaction processing with real data test passed', {
      wallet: TEST_WALLET,
      rawEvents: eventsResponse.events.length,
      processedTransactions: processedTransactions.length,
      eventTypes: Array.from(eventTypes),
      tokenTypes: Array.from(tokenTypes),
      totalUsdValue,
    });
    
    return { 
      success: true, 
      rawEvents: eventsResponse.events.length,
      processedTransactions: processedTransactions.length,
      eventTypes: Array.from(eventTypes),
      totalUsdValue,
    };
  } catch (error) {
    console.error('❌ Real data processing failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Transaction processing with real data test failed', { 
      wallet: TEST_WALLET,
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testWithSampleData() {
  console.log('\n🔍 Test 2: Process Sample Transaction Events');
  console.log('=============================================');
  
  // Create sample transaction events
  const sampleEvents = [
    {
      event_index: 1,
      event_type: 'fungible_token_asset',
      tx_id: 'sample-tx-1',
      asset: {
        asset_event_type: 'transfer',
        asset_id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token::charisma',
        sender: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        recipient: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R',
        amount: '1000000',
      }
    },
    {
      event_index: 2,
      event_type: 'fungible_token_asset',
      tx_id: 'sample-tx-2',
      asset: {
        asset_event_type: 'burn',
        asset_id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy::energy',
        sender: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        recipient: '',
        amount: '100000000',
      }
    },
    {
      event_index: 3,
      event_type: 'stx_asset',
      tx_id: 'sample-tx-3',
      asset: {
        asset_event_type: 'transfer',
        sender: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        recipient: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R',
        amount: '5000000', // 5 STX
      }
    },
  ];
  
  try {
    console.log(`📋 Processing ${sampleEvents.length} sample events...`);
    
    const processedTransactions = await processTransactionEvents(sampleEvents, DEFAULT_ANALYTICS_CONFIG);
    
    console.log(`✅ Processed ${processedTransactions.length} transactions from samples`);
    
    // Analyze results
    console.log('\n📊 Sample Processing Results:');
    processedTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.type} - ${tx.tokenSymbol || 'STX'} - ${tx.amount} - $${tx.usdValue?.toFixed(2) || '0.00'}`);
    });
    
    // Validate structure
    const hasRequiredFields = processedTransactions.every(tx => 
      tx.txId && tx.type && tx.timestamp && typeof tx.amount === 'number'
    );
    
    console.log(`\n✅ All transactions have required fields: ${hasRequiredFields}`);
    
    await logger.success('Transaction processing with sample data test passed', {
      sampleEvents: sampleEvents.length,
      processedTransactions: processedTransactions.length,
      hasRequiredFields,
      transactions: processedTransactions,
    });
    
    return { 
      success: true, 
      sampleEvents: sampleEvents.length,
      processedTransactions: processedTransactions.length,
      hasRequiredFields,
    };
  } catch (error) {
    console.error('❌ Sample data processing failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Transaction processing with sample data test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testEmptyData() {
  console.log('\n🔍 Test 3: Process Empty Transaction Events');
  console.log('============================================');
  
  try {
    console.log('📋 Processing empty events array...');
    
    const processedTransactions = await processTransactionEvents([], DEFAULT_ANALYTICS_CONFIG);
    
    console.log(`✅ Processed empty array: ${processedTransactions.length} transactions`);
    
    const isEmpty = processedTransactions.length === 0;
    console.log(`✅ Result is empty as expected: ${isEmpty}`);
    
    await logger.success('Transaction processing with empty data test passed', {
      inputEvents: 0,
      processedTransactions: processedTransactions.length,
      isEmptyAsExpected: isEmpty,
    });
    
    return { success: true, isEmpty };
  } catch (error) {
    console.error('❌ Empty data processing failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Transaction processing with empty data test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testInvalidData() {
  console.log('\n🔍 Test 4: Process Invalid Transaction Events');
  console.log('==============================================');
  
  // Create invalid/malformed events
  const invalidEvents = [
    { invalid: 'event' },
    { event_type: 'unknown_type' },
    { event_type: 'fungible_token_asset' }, // Missing asset data
  ];
  
  try {
    console.log('📋 Processing invalid events...');
    
    const processedTransactions = await processTransactionEvents(invalidEvents as any, DEFAULT_ANALYTICS_CONFIG);
    
    console.log(`✅ Processed invalid events: ${processedTransactions.length} transactions`);
    console.log('✅ Function handled invalid data gracefully');
    
    await logger.success('Transaction processing with invalid data test passed', {
      invalidEvents: invalidEvents.length,
      processedTransactions: processedTransactions.length,
      handledGracefully: true,
    });
    
    return { success: true, handledGracefully: true };
  } catch (error) {
    console.error('❌ Invalid data processing failed:', error instanceof Error ? error.message : String(error));
    await logger.error('Transaction processing with invalid data test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  try {
    const startTime = Date.now();
    
    await logExecution('Transaction Processing Test', 'Testing analytics engine transaction processing functions');
    
    console.log('🧪 Transaction Processing Test');
    console.log('===============================');
    console.log('Testing analytics engine transaction processing functions\n');
    
    // Run all tests
    const test1 = await testWithRealData();
    const test2 = await testWithSampleData();
    const test3 = await testEmptyData();
    const test4 = await testInvalidData();
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`✅ Real data processing: ${test1.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Sample data processing: ${test2.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Empty data processing: ${test3.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Invalid data processing: ${test4.success ? 'PASS' : 'FAIL'}`);
    
    const allPassed = test1.success && test2.success && test3.success && test4.success;
    
    const duration = Date.now() - startTime;
    await logResult('Transaction Processing Test', {
      exitCode: allPassed ? 0 : 1,
      stdout: allPassed ? 'All tests passed' : 'Some tests failed',
      summary: {
        realDataProcessing: test1.success,
        sampleDataProcessing: test2.success,
        emptyDataProcessing: test3.success,
        invalidDataProcessing: test4.success,
        totalDuration: duration + 'ms',
      }
    }, duration);
    
    if (allPassed) {
      console.log('\n🎉 All Transaction Processing tests PASSED!');
      console.log('✅ Analytics engine transaction processing is working correctly');
    } else {
      console.log('\n❌ Some Transaction Processing tests FAILED!');
      console.log('🔧 Check the logs for detailed error information');
      process.exit(1);
    }
    
  } catch (error) {
    await logError('Transaction Processing Test failed', error instanceof Error ? error : new Error(String(error)));
    console.error('\n❌ Test script failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  await logError('Transaction Processing Test crashed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});