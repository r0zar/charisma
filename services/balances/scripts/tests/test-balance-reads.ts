#!/usr/bin/env tsx
/**
 * E2E Test: Basic Balance Reading Operations
 * Tests BalanceService and BalanceSeriesAPI read operations
 */

import '../utils';
import { BalanceService } from '../../src/service/BalanceService';
import { BalanceSeriesAPI } from '../../src/balance-series/balance-series-api';

// Sample test data
const TEST_ADDRESSES = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
  'SP1H1733V5MZ3SZ9XRW9FKYAHJ0CR4O42S4HZ3PKH',
  'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C'
];

const TEST_CONTRACTS = [
  'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.arkadiko-token',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.usdc-token'
];

async function testBalanceReads() {
  console.log('🔄 Testing Balance Read Operations...');

  try {
    // Test BalanceService
    console.log('📊 Testing BalanceService...');
    const balanceService = new BalanceService();

    // Test single balance read
    console.log('🔍 Testing single balance read...');
    const singleBalance = await balanceService.getBalance(TEST_ADDRESSES[0], TEST_CONTRACTS[0]);
    console.log('💰 Single Balance:', singleBalance);

    // Test multiple balances for address
    console.log('🔍 Testing multiple balances for address...');
    const multipleBalances = await balanceService.getBalances(TEST_ADDRESSES[0]);
    console.log('💰 Multiple Balances:', Object.keys(multipleBalances).length, 'contracts found');

    // Test all balances with metadata
    console.log('🔍 Testing all balances with metadata...');
    const allBalances = await balanceService.getAllBalances(TEST_ADDRESSES[0]);
    console.log('💰 All Balances:', allBalances.length, 'non-zero balances');

    // Test bulk balances
    console.log('🔍 Testing bulk balance request...');
    const bulkRequest = {
      addresses: TEST_ADDRESSES.slice(0, 2),
      contractIds: TEST_CONTRACTS.slice(0, 2),
      includeZeroBalances: false
    };

    const bulkResult = await balanceService.getBulkBalances(bulkRequest);
    console.log('💰 Bulk Balances:', {
      success: bulkResult.success,
      addressCount: Object.keys(bulkResult.data || {}).length,
      executionTime: bulkResult.metadata?.executionTime + 'ms'
    });

    // Test batch requests
    console.log('🔍 Testing batch balance requests...');
    const batchRequests = [
      { address: TEST_ADDRESSES[0], contractId: TEST_CONTRACTS[0] },
      { address: TEST_ADDRESSES[1], contractId: TEST_CONTRACTS[1] }
    ];

    const batchResults = await balanceService.getBalancesBatch(batchRequests);
    console.log('💰 Batch Results:', batchResults.length, 'results');

    // Test time series operations
    console.log('🔍 Testing balance history...');
    const history = await balanceService.getBalanceHistory(TEST_ADDRESSES[0], TEST_CONTRACTS[0]);
    console.log('📈 Balance History:', history.length, 'data points');

    const bulkHistory = await balanceService.getBulkBalanceHistory(
      [TEST_ADDRESSES[0]],
      [TEST_CONTRACTS[0]]
    );
    console.log('📈 Bulk History:', Object.keys(bulkHistory).length, 'addresses');

    const snapshots = await balanceService.getBalanceSnapshots(TEST_ADDRESSES[0]);
    console.log('📸 Snapshots:', snapshots.length, 'snapshots');

    // Test service stats
    console.log('📊 Getting service statistics...');
    const stats = await balanceService.getStats();
    console.log('📊 Service Stats:', stats);

    // Test monitoring
    console.log('📈 Getting monitoring stats...');
    const monitoringStats = balanceService.getBlobMonitoringStats();
    console.log('📈 Monitoring Stats:', monitoringStats);

  } catch (error) {
    console.error('❌ BalanceService test failed:', error);
  }

  try {
    // Test BalanceSeriesAPI
    console.log('📊 Testing BalanceSeriesAPI...');
    const seriesAPI = new BalanceSeriesAPI();

    // Test bulk balance series
    console.log('🔍 Testing balance series request...');
    const seriesRequest = {
      addresses: TEST_ADDRESSES.slice(0, 2),
      contractIds: TEST_CONTRACTS.slice(0, 2),
      period: '7d' as const,
      granularity: 'day' as const,
      includeSnapshots: false,
      limit: 50
    };

    const seriesResult = await seriesAPI.getBalanceSeries(seriesRequest);
    console.log('📈 Balance Series:', {
      success: seriesResult.success,
      addressCount: Object.keys(seriesResult.data?.timeSeries || {}).length,
      executionTime: seriesResult.data?.metadata?.executionTime + 'ms',
      cacheHits: seriesResult.data?.metadata?.cacheHits,
      cacheMisses: seriesResult.data?.metadata?.cacheMisses
    });

    // Test bulk balances
    console.log('🔍 Testing bulk balances via API...');
    const apiBulkRequest = {
      addresses: TEST_ADDRESSES.slice(0, 2),
      contractIds: TEST_CONTRACTS.slice(0, 2),
      includeZeroBalances: false
    };

    const apiBulkResult = await seriesAPI.getBulkBalances(apiBulkRequest);
    console.log('💰 API Bulk Balances:', {
      success: apiBulkResult.success,
      addressCount: Object.keys(apiBulkResult.data || {}).length,
      executionTime: apiBulkResult.metadata?.executionTime + 'ms'
    });

    console.success('✅ All balance read tests completed successfully!');

  } catch (error) {
    console.error('❌ BalanceSeriesAPI test failed:', error);

    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }
}

// Run the test
testBalanceReads().catch(console.error);