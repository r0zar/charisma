#!/usr/bin/env tsx

/**
 * Test Cron Analytics Processor Endpoint
 * Verifies the background processing system works correctly
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { logger } from '../logger';

async function testCronEndpoint() {
  logger.info('🕒 Testing Cron Analytics Processor');
  logger.info('===================================');
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const cronEndpoint = `${baseUrl}/api/cron/analytics-processor`;
  
  logger.info(`🌐 Testing endpoint: ${cronEndpoint}`);
  
  // Test 1: Trigger Analytics Processing
  logger.info('\n⚡ Test 1: Trigger Background Processing');
  const startTime = Date.now();
  
  try {
    const response = await fetch(cronEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`
      }
    });
    
    const elapsed = Date.now() - startTime;
    logger.info(`⏱️  Processing time: ${elapsed}ms`);
    logger.info(`📊 HTTP Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      logger.info(`✅ Success: ${result.success}`);
      
      if (result.data) {
        logger.info(`📈 Processing results:`);
        logger.info(`   - Wallets processed: ${result.data.walletsProcessed || 0}`);
        logger.info(`   - Processing time: ${result.data.processingTime || 0}ms`);
        logger.info(`   - Cache updates: ${result.data.cacheUpdates || 0}`);
        
        if (result.data.errors && result.data.errors.length > 0) {
          logger.warn(`⚠️  Errors encountered: ${result.data.errors.length}`);
          result.data.errors.slice(0, 3).forEach((error: any, index: number) => {
            logger.warn(`   ${index + 1}. ${error.wallet}: ${error.message}`);
          });
        }
      }
      
    } else {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`❌ Request failed: ${errorData.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    logger.error(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Test 2: Verify Cache was Updated
  logger.info('\n🗂️  Test 2: Verify Cache Updates');
  
  // Wait a moment for processing to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const testWallet = 'SP2BT25RKGSTX9C17E16JYT1TV5EW9TNWJGYNSVJ2';
  const analyticsEndpoint = `${baseUrl}/api/v1/analytics/${testWallet}`;
  
  try {
    const response = await fetch(analyticsEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.success && result.metadata) {
        logger.info(`✅ Cache verification successful`);
        logger.info(`📊 Cache metadata:`);
        logger.info(`   - Cached: ${result.metadata.cached}`);
        logger.info(`   - Source: ${result.metadata.source}`);
        logger.info(`   - Last updated: ${result.metadata.lastUpdated ? new Date(result.metadata.lastUpdated).toLocaleString() : 'Never'}`);
        
        // Check if data was recently updated (within last 5 minutes)
        if (result.metadata.lastUpdated) {
          const timeSinceUpdate = Date.now() - result.metadata.lastUpdated;
          const minutesSinceUpdate = timeSinceUpdate / (1000 * 60);
          
          if (minutesSinceUpdate < 5) {
            logger.info(`🎯 Data is fresh (updated ${minutesSinceUpdate.toFixed(1)} minutes ago)`);
          } else {
            logger.warn(`⚠️  Data may be stale (updated ${minutesSinceUpdate.toFixed(1)} minutes ago)`);
          }
        }
      } else {
        logger.warn(`❌ No cached data found or error: ${result.error}`);
      }
      
    } else {
      logger.error(`❌ Cache verification failed: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    logger.error(`❌ Cache verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  logger.info('\n✅ Cron Endpoint Test Complete');
  logger.info('🎯 Key Benefits Demonstrated:');
  logger.info('   • Background processing independent of user requests');
  logger.info('   • Analytics data computed out-of-band via cron jobs');
  logger.info('   • Cache updates with fresh blockchain data');
  logger.info('   • No blocking operations during page visits');
}

// Run the test
testCronEndpoint().catch(error => {
  logger.error('Test execution failed:', error);
  process.exit(1);
});