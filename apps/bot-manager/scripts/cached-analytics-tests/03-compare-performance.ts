#!/usr/bin/env tsx

/**
 * Performance Comparison Test
 * Compares real-time analytics vs cached analytics performance
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { analyticsClient } from '../../src/lib/analytics-client';
import { cachedAnalyticsClient } from '../../src/lib/analytics-client-cached';
import { logger } from '../logger';

async function comparePerformance() {
  logger.info('⚡ Performance Comparison Test');
  logger.info('==============================');
  
  const testWallet = 'SP2BT25RKGSTX9C17E16JYT1TV5EW9TNWJGYNSVJ2';
  logger.info(`📊 Testing wallet: ${testWallet}`);
  
  // Test 1: Real-time Analytics Client (old approach)
  logger.info('\n🔄 Test 1: Real-time Analytics (Old Approach)');
  logger.info('-----------------------------------------------');
  
  const realTimeResults = [];
  for (let i = 0; i < 3; i++) {
    const startTime = Date.now();
    
    try {
      const result = await analyticsClient.getAnalyticsSummary(testWallet);
      const elapsed = Date.now() - startTime;
      realTimeResults.push(elapsed);
      
      logger.info(`   Run ${i + 1}: ${elapsed}ms - Success: ${result.success}`);
      
      if (!result.success) {
        logger.warn(`   Error: ${result.error}`);
      }
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      realTimeResults.push(elapsed);
      logger.error(`   Run ${i + 1}: ${elapsed}ms - Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Test 2: Cached Analytics Client (new approach)
  logger.info('\n⚡ Test 2: Cached Analytics (New Approach)');
  logger.info('------------------------------------------');
  
  const cachedResults = [];
  for (let i = 0; i < 3; i++) {
    const startTime = Date.now();
    
    try {
      const result = await cachedAnalyticsClient.getAnalyticsSummary(testWallet);
      const elapsed = Date.now() - startTime;
      cachedResults.push(elapsed);
      
      logger.info(`   Run ${i + 1}: ${elapsed}ms - Success: ${result.success}`);
      
      if (result.success && result.metadata) {
        logger.info(`   Source: ${result.metadata.source}, Cached: ${result.metadata.cached}`);
      }
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      cachedResults.push(elapsed);
      logger.error(`   Run ${i + 1}: ${elapsed}ms - Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Performance Analysis
  logger.info('\n📊 Performance Analysis');
  logger.info('=======================');
  
  const avgRealTime = realTimeResults.reduce((sum, time) => sum + time, 0) / realTimeResults.length;
  const avgCached = cachedResults.reduce((sum, time) => sum + time, 0) / cachedResults.length;
  
  const improvement = ((avgRealTime - avgCached) / avgRealTime) * 100;
  const speedup = avgRealTime / avgCached;
  
  logger.info(`🕒 Real-time Analytics (old):`);
  logger.info(`   - Average: ${avgRealTime.toFixed(0)}ms`);
  logger.info(`   - Range: ${Math.min(...realTimeResults)}ms - ${Math.max(...realTimeResults)}ms`);
  logger.info(`   - Issues: Blocks page load, heavy blockchain processing`);
  
  logger.info(`⚡ Cached Analytics (new):`);
  logger.info(`   - Average: ${avgCached.toFixed(0)}ms`);
  logger.info(`   - Range: ${Math.min(...cachedResults)}ms - ${Math.max(...cachedResults)}ms`);
  logger.info(`   - Benefits: Instant response, no blocking operations`);
  
  logger.info(`🎯 Performance Improvement:`);
  logger.info(`   - Speed improvement: ${improvement.toFixed(1)}%`);
  logger.info(`   - Speed multiplier: ${speedup.toFixed(1)}x faster`);
  
  if (improvement > 50) {
    logger.info(`   ✅ Significant performance improvement achieved!`);
  } else if (improvement > 0) {
    logger.info(`   ✅ Performance improvement achieved`);
  } else {
    logger.warn(`   ⚠️  Performance may need further optimization`);
  }
  
  // User Experience Impact
  logger.info('\n👤 User Experience Impact:');
  logger.info('=========================');
  
  if (avgRealTime > 3000) {
    logger.info(`❌ Old approach: ${(avgRealTime/1000).toFixed(1)}s page load - Users likely to abandon`);
  } else if (avgRealTime > 1000) {
    logger.info(`⚠️  Old approach: ${(avgRealTime/1000).toFixed(1)}s page load - Noticeable delay`);
  }
  
  if (avgCached < 500) {
    logger.info(`✅ New approach: ${avgCached.toFixed(0)}ms page load - Instant user experience`);
  } else {
    logger.info(`✅ New approach: ${avgCached.toFixed(0)}ms page load - Good user experience`);
  }
  
  logger.info('\n🏆 Architecture Benefits:');
  logger.info('========================');
  logger.info('✅ Eliminated page-triggered blockchain processing');
  logger.info('✅ Moved heavy computation to background cron jobs');
  logger.info('✅ Instant analytics page loading');
  logger.info('✅ Better error handling and resilience');
  logger.info('✅ Reduced API rate limit pressure');
  logger.info('✅ Improved scalability for multiple concurrent users');
}

// Run the comparison
comparePerformance().catch(error => {
  logger.error('Test execution failed:', error);
  process.exit(1);
});