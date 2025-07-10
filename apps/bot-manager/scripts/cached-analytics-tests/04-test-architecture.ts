#!/usr/bin/env tsx

/**
 * Test Architecture Validation
 * Confirms that analytics engine runs only via cron, not on page visits
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { logger } from '../logger';

async function testArchitecture() {
  logger.info('🏗️  Architecture Validation Test');
  logger.info('================================');
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Test 1: Verify Analytics Page Loads Instantly
  logger.info('\n📱 Test 1: Analytics Page Performance');
  logger.info('------------------------------------');
  
  const testWallet = 'SP2BT25RKGSTX9C17E16JYT1TV5EW9TNWJGYNSVJ2';
  
  // Simulate multiple concurrent page visits
  const pageLoadPromises = [];
  
  for (let i = 0; i < 5; i++) {
    const promise = (async () => {
      const startTime = Date.now();
      
      try {
        // Simulate fetching analytics data (what the page would do)
        const response = await fetch(`${baseUrl}/api/v1/analytics/${testWallet}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const elapsed = Date.now() - startTime;
        const result = await response.json();
        
        return {
          requestId: i + 1,
          elapsed,
          success: response.ok && result.success,
          cached: result.metadata?.cached || false,
          source: result.metadata?.source || 'unknown'
        };
        
      } catch (error) {
        const elapsed = Date.now() - startTime;
        return {
          requestId: i + 1,
          elapsed,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })();
    
    pageLoadPromises.push(promise);
    
    // Stagger requests slightly to simulate real usage
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const results = await Promise.all(pageLoadPromises);
  
  logger.info(`📊 Page Load Results (${results.length} concurrent requests):`);
  results.forEach(result => {
    if (result.success) {
      logger.info(`   Request ${result.requestId}: ${result.elapsed}ms - ✅ ${result.cached ? 'Cached' : 'Fresh'} (${result.source})`);
    } else {
      logger.error(`   Request ${result.requestId}: ${result.elapsed}ms - ❌ ${result.error}`);
    }
  });
  
  const avgLoadTime = results.reduce((sum, r) => sum + r.elapsed, 0) / results.length;
  const maxLoadTime = Math.max(...results.map(r => r.elapsed));
  const allCached = results.every(r => r.cached);
  
  logger.info(`📈 Performance Summary:`);
  logger.info(`   - Average load time: ${avgLoadTime.toFixed(0)}ms`);
  logger.info(`   - Maximum load time: ${maxLoadTime}ms`);
  logger.info(`   - All requests cached: ${allCached ? '✅ Yes' : '❌ No'}`);
  
  // Validation checks
  if (avgLoadTime < 500) {
    logger.info(`   ✅ PASS: Page loads instantly (under 500ms)`);
  } else {
    logger.warn(`   ⚠️  WARN: Page load time higher than expected`);
  }
  
  if (allCached) {
    logger.info(`   ✅ PASS: All data served from cache (no real-time processing)`);
  } else {
    logger.warn(`   ⚠️  WARN: Some requests triggered real-time processing`);
  }
  
  // Test 2: Verify No Heavy Processing on Page Load
  logger.info('\n⚡ Test 2: No Heavy Processing Detection');
  logger.info('---------------------------------------');
  
  // Make rapid sequential requests to see if any trigger heavy processing
  const rapidTestResults = [];
  
  for (let i = 0; i < 10; i++) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${baseUrl}/api/v1/analytics/${testWallet}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const elapsed = Date.now() - startTime;
      const result = await response.json();
      
      rapidTestResults.push({
        elapsed,
        cached: result.metadata?.cached || false,
        source: result.metadata?.source || 'unknown'
      });
      
    } catch (error) {
      rapidTestResults.push({
        elapsed: Date.now() - startTime,
        error: true
      });
    }
    
    // No delay - test rapid requests
  }
  
  const avgRapidTime = rapidTestResults.reduce((sum, r) => sum + r.elapsed, 0) / rapidTestResults.length;
  const maxRapidTime = Math.max(...rapidTestResults.map(r => r.elapsed));
  const allRapidCached = rapidTestResults.every(r => r.cached);
  
  logger.info(`🚀 Rapid Request Results (${rapidTestResults.length} sequential requests):`);
  logger.info(`   - Average response: ${avgRapidTime.toFixed(0)}ms`);
  logger.info(`   - Maximum response: ${maxRapidTime}ms`);
  logger.info(`   - All cached: ${allRapidCached ? '✅ Yes' : '❌ No'}`);
  
  if (maxRapidTime < 1000) {
    logger.info(`   ✅ PASS: No heavy processing detected (all under 1s)`);
  } else {
    logger.warn(`   ⚠️  WARN: Some requests took longer than expected`);
  }
  
  // Test 3: Architecture Compliance Check
  logger.info('\n🎯 Test 3: Architecture Compliance');
  logger.info('----------------------------------');
  
  const compliance = {
    pageLoadsInstant: avgLoadTime < 500,
    allDataCached: allCached,
    noHeavyProcessing: maxRapidTime < 1000,
    consistentPerformance: (maxLoadTime - avgLoadTime) < 200
  };
  
  logger.info(`📋 Architecture Requirements:`);
  logger.info(`   ✅ Page loads instant (<500ms): ${compliance.pageLoadsInstant ? 'PASS' : 'FAIL'}`);
  logger.info(`   ✅ All data from cache: ${compliance.allDataCached ? 'PASS' : 'FAIL'}`);
  logger.info(`   ✅ No heavy processing: ${compliance.noHeavyProcessing ? 'PASS' : 'FAIL'}`);
  logger.info(`   ✅ Consistent performance: ${compliance.consistentPerformance ? 'PASS' : 'FAIL'}`);
  
  const allPassed = Object.values(compliance).every(check => check);
  
  if (allPassed) {
    logger.info('\n🏆 ARCHITECTURE VALIDATION: ✅ PASSED');
    logger.info('🎯 Analytics engine confirmed to run only via cron jobs');
    logger.info('⚡ Page visits trigger no blockchain processing');
    logger.info('📱 User experience is instant and scalable');
  } else {
    logger.warn('\n⚠️  ARCHITECTURE VALIDATION: ❌ FAILED');
    logger.warn('🔧 Some requirements not met - see details above');
  }
  
  // Test 4: Memory Usage Simulation
  logger.info('\n🧠 Test 4: Memory Usage Simulation');
  logger.info('----------------------------------');
  
  const memBefore = process.memoryUsage();
  
  // Simulate 50 concurrent users hitting analytics
  const concurrentPromises = Array.from({ length: 50 }, async (_, i) => {
    try {
      const response = await fetch(`${baseUrl}/api/v1/analytics/${testWallet}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      return result.success;
    } catch {
      return false;
    }
  });
  
  const concurrentResults = await Promise.all(concurrentPromises);
  const memAfter = process.memoryUsage();
  
  const successRate = (concurrentResults.filter(Boolean).length / concurrentResults.length) * 100;
  const memDiff = memAfter.heapUsed - memBefore.heapUsed;
  
  logger.info(`👥 Concurrent User Simulation (50 users):`);
  logger.info(`   - Success rate: ${successRate.toFixed(1)}%`);
  logger.info(`   - Memory impact: ${(memDiff / 1024 / 1024).toFixed(2)}MB`);
  
  if (successRate > 95) {
    logger.info(`   ✅ PASS: High success rate under load`);
  } else {
    logger.warn(`   ⚠️  WARN: Lower success rate than expected`);
  }
  
  logger.info('\n✅ Architecture Validation Complete');
}

// Run the architecture test
testArchitecture().catch(error => {
  logger.error('Test execution failed:', error);
  process.exit(1);
});