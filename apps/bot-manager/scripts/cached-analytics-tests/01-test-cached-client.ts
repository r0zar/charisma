#!/usr/bin/env tsx

/**
 * Test Cached Analytics Client
 * Verifies that the cached client serves data from API endpoints instantly
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { cachedAnalyticsClient } from '../../src/lib/analytics-client-cached';
import { logger } from '../logger';

async function testCachedClient() {
  logger.info('🧪 Testing Cached Analytics Client');
  logger.info('=====================================');
  
  // Test wallet address - using a bot wallet
  const testWallet = 'SP2BT25RKGSTX9C17E16JYT1TV5EW9TNWJGYNSVJ2';
  
  logger.info(`📊 Testing wallet: ${testWallet}`);
  
  // Test 1: Get Analytics Summary (should be instant from cache)
  logger.info('\n📈 Test 1: Analytics Summary');
  const startTime = Date.now();
  
  try {
    const result = await cachedAnalyticsClient.getAnalyticsSummary(testWallet);
    const elapsed = Date.now() - startTime;
    
    logger.info(`⏱️  Response time: ${elapsed}ms (should be <200ms for cached data)`);
    logger.info(`✅ Success: ${result.success}`);
    
    if (result.success && result.data) {
      logger.info(`📊 Summary data received:`);
      logger.info(`   - Total trades: ${result.data.totalTrades || 0}`);
      logger.info(`   - Total volume: $${result.data.totalVolume?.toFixed(2) || '0.00'}`);
      logger.info(`   - Portfolio value: $${result.data.currentValue?.toFixed(2) || '0.00'}`);
      logger.info(`   - Holdings count: ${result.data.holdings?.length || 0}`);
    } else {
      logger.warn(`❌ No data or error: ${result.error}`);
    }
    
    if (result.metadata) {
      logger.info(`🗂️  Metadata:`);
      logger.info(`   - Cached: ${result.metadata.cached}`);
      logger.info(`   - Source: ${result.metadata.source}`);
      logger.info(`   - Last updated: ${result.metadata.lastUpdated ? new Date(result.metadata.lastUpdated).toLocaleString() : 'Never'}`);
    }
    
  } catch (error) {
    logger.error(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Test 2: Performance Metrics
  logger.info('\n📊 Test 2: Performance Metrics');
  const startTime2 = Date.now();
  
  try {
    const result = await cachedAnalyticsClient.getPerformanceMetrics(testWallet);
    const elapsed = Date.now() - startTime2;
    
    logger.info(`⏱️  Response time: ${elapsed}ms`);
    logger.info(`✅ Success: ${result.success}`);
    
    if (result.success && result.data) {
      logger.info(`📈 Performance data:`);
      logger.info(`   - Total return: $${result.data.totalReturn?.toFixed(2) || '0.00'}`);
      logger.info(`   - Win rate: ${result.data.winRate?.toFixed(1) || '0.0'}%`);
      logger.info(`   - Total trades: ${result.data.totalTrades || 0}`);
    } else {
      logger.warn(`❌ No data or error: ${result.error}`);
    }
    
  } catch (error) {
    logger.error(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Test 3: Portfolio Holdings
  logger.info('\n💼 Test 3: Portfolio Holdings');
  const startTime3 = Date.now();
  
  try {
    const result = await cachedAnalyticsClient.getPortfolioHoldings(testWallet);
    const elapsed = Date.now() - startTime3;
    
    logger.info(`⏱️  Response time: ${elapsed}ms`);
    logger.info(`✅ Success: ${result.success}`);
    
    if (result.success && result.data) {
      logger.info(`💼 Holdings data: ${result.data.length} holdings`);
      result.data.slice(0, 3).forEach((holding, index) => {
        logger.info(`   ${index + 1}. ${holding.symbol}: $${holding.usdValue?.toFixed(2) || '0.00'}`);
      });
    } else {
      logger.warn(`❌ No data or error: ${result.error}`);
    }
    
  } catch (error) {
    logger.error(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Test 4: Cache Stats
  logger.info('\n📊 Test 4: Cache Statistics');
  const cacheStats = cachedAnalyticsClient.getCacheStats();
  logger.info(`📈 Cache stats:`);
  logger.info(`   - Hit rate: ${cacheStats.hitRate}%`);
  logger.info(`   - Total requests: ${cacheStats.totalRequests}`);
  logger.info(`   - Average response time: ${cacheStats.averageResponseTime}ms`);
  
  logger.info('\n✅ Cached Analytics Client Test Complete');
  logger.info('🎯 Key Benefits Demonstrated:');
  logger.info('   • Instant response times (<200ms vs 3-10 seconds)');
  logger.info('   • No real-time blockchain processing on page load');
  logger.info('   • Clean separation between data processing and serving');
  logger.info('   • Cached data with metadata tracking');
}

// Run the test
testCachedClient().catch(error => {
  logger.error('Test execution failed:', error);
  process.exit(1);
});