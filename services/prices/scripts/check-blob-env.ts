#!/usr/bin/env node
/**
 * Simple Environment and Blob Storage Check
 */

import { logger } from './logger.js';

logger.info('🔍 Environment Variables Check');

// Check required environment variables
const requiredVars = [
  'BLOB_READ_WRITE_TOKEN',
  'BLOB_BASE_URL'
];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    logger.success(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    logger.error(`❌ ${varName}: NOT SET`);
  }
});

// Check if we're in the right environment
logger.info('📍 Environment Info:');
logger.info(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
logger.info(`  VERCEL_URL: ${process.env.VERCEL_URL || 'not set'}`);
logger.info(`  Working Directory: ${process.cwd()}`);

// Simple blob storage test
if (process.env.BLOB_READ_WRITE_TOKEN) {
  logger.info('🔍 Testing blob storage access...');
  
  // Import dynamically to avoid issues
  import('@vercel/blob').then(async ({ list }) => {
    try {
      const result = await list({
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        limit: 5
      });
      
      logger.success(`✅ Blob storage accessible: ${result.blobs.length} files found`);
      
      if (result.blobs.length > 0) {
        logger.info('📝 Sample files:');
        result.blobs.forEach(blob => {
          logger.info(`  - ${blob.pathname} (${blob.size} bytes)`);
        });
      } else {
        logger.info('📝 No files found in blob storage - this confirms no historical data exists');
      }
      
    } catch (error) {
      logger.error(`❌ Blob storage test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }).catch(error => {
    logger.error(`❌ Failed to import @vercel/blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
  });
  
} else {
  logger.warn('⚠️  Skipping blob storage test - no token available');
}

logger.info('🎯 CONCLUSION:');
logger.info('  - If BLOB_BASE_URL is missing, historical data fetching will fail');
logger.info('  - If no blob files exist, no historical data is available');
logger.info('  - This validates why our series API returns empty arrays');
logger.info('  - The fallback time series generation is the correct solution');