#!/usr/bin/env node
/**
 * Historical Data Validation Script
 * 
 * This script checks if historical price data is available in blob storage
 * and validates our assumption that no historical data exists yet.
 */

import { logger } from './logger.js';
import { PriceSeriesAPI, PriceSeriesStorage } from '../src/index.js';
import { list } from '@vercel/blob';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!BLOB_READ_WRITE_TOKEN) {
  logger.error('BLOB_READ_WRITE_TOKEN environment variable is required');
  logger.error('Please set BLOB_READ_WRITE_TOKEN in your .env.local file');
  process.exit(1);
}

logger.info('🔍 Starting Historical Data Validation');

// Initialize storage and API
const storage = new PriceSeriesStorage(BLOB_READ_WRITE_TOKEN);
const priceAPI = new PriceSeriesAPI(storage);

async function validateHistoricalData() {
  try {
    logger.info('📊 Checking blob storage for historical data...');

    // Check for snapshots
    logger.info('🔍 Scanning for snapshot files...');
    const snapshots = await list({
      prefix: 'snapshots/',
      token: BLOB_READ_WRITE_TOKEN,
      limit: 1000
    });

    logger.info(`📸 Found ${snapshots.blobs.length} snapshot files`);

    if (snapshots.blobs.length > 0) {
      logger.info('📝 All snapshot files:');
      snapshots.blobs.forEach(blob => {
        logger.info(`  - ${blob.pathname} (${blob.size} bytes, ${new Date(blob.uploadedAt).toLocaleString()})`);
      });
    }

    // Check for time series data
    logger.info('🔍 Scanning for time series files...');
    const timeSeries = await list({
      prefix: 'series/',
      token: BLOB_READ_WRITE_TOKEN,
      limit: 1000
    });

    logger.info(`📈 Found ${timeSeries.blobs.length} time series files`);

    if (timeSeries.blobs.length > 0) {
      logger.info('📝 All time series files:');
      timeSeries.blobs.forEach(blob => {
        logger.info(`  - ${blob.pathname} (${blob.size} bytes, ${new Date(blob.uploadedAt).toLocaleString()})`);
      });
    }

    // Check for arbitrage data
    logger.info('🔍 Scanning for arbitrage files...');
    const arbitrage = await list({
      prefix: 'arbitrage/',
      token: BLOB_READ_WRITE_TOKEN,
      limit: 1000
    });

    logger.info(`🎯 Found ${arbitrage.blobs.length} arbitrage files`);

    if (arbitrage.blobs.length > 0) {
      logger.info('📝 All arbitrage files:');
      arbitrage.blobs.forEach(blob => {
        logger.info(`  - ${blob.pathname} (${blob.size} bytes, ${new Date(blob.uploadedAt).toLocaleString()})`);
      });
    }

    // Test getting current tokens
    logger.info('🔍 Testing PriceSeriesAPI.getAllTokens()...');
    const tokensResult = await priceAPI.getAllTokens();

    if (tokensResult.success) {
      logger.success(`✅ Found ${tokensResult.data?.length || 0} tokens available`);

      if (tokensResult.data && tokensResult.data.length > 0) {
        logger.info('📝 Sample tokens:');
        tokensResult.data.slice(0, 3).forEach(token => {
          logger.info(`  - ${token.symbol} (${token.tokenId}) - $${token.usdPrice}`);
        });

        // Test historical data for first token
        const firstToken = tokensResult.data[0];
        logger.info(`🔍 Testing historical data for ${firstToken.symbol}...`);

        const historyResult = await priceAPI.getPriceHistory({
          tokenId: firstToken.tokenId,
          timeframe: '1h',
          limit: 10
        });

        if (historyResult.success) {
          logger.success(`✅ Historical data available: ${historyResult.data?.length || 0} data points`);

          if (historyResult.data && historyResult.data.length > 0) {
            logger.info('📝 Sample historical data:');
            historyResult.data.slice(0, 3).forEach(point => {
              logger.info(`  - ${new Date(point.timestamp).toLocaleString()}: $${point.usdPrice}`);
            });
          } else {
            logger.warn('⚠️  Historical data API succeeded but returned empty array');
          }
        } else {
          logger.error(`❌ Historical data API failed: ${historyResult.error}`);
        }
      } else {
        logger.warn('⚠️  No tokens available from API');
      }
    } else {
      logger.error(`❌ Failed to get tokens: ${tokensResult.error}`);
    }

    // Summary
    logger.info('📊 SUMMARY:');
    logger.info(`  - Snapshot files: ${snapshots.blobs.length}`);
    logger.info(`  - Time series files: ${timeSeries.blobs.length}`);
    logger.info(`  - Arbitrage files: ${arbitrage.blobs.length}`);
    logger.info(`  - Total blob files: ${snapshots.blobs.length + timeSeries.blobs.length + arbitrage.blobs.length}`);

    if (snapshots.blobs.length === 0 && timeSeries.blobs.length === 0) {
      logger.success('✅ ASSUMPTION VALIDATED: No historical data exists in blob storage');
      logger.info('💡 This confirms why the series API returns empty arrays - no historical data has been stored yet');
      logger.info('🎯 The fallback time series generation is necessary and appropriate');
    } else {
      logger.warn('⚠️  ASSUMPTION INVALID: Historical data exists but may not be accessible via API');
      logger.info('🔍 Further investigation needed into PriceSeriesAPI implementation');
    }

  } catch (error) {
    logger.error(`❌ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run validation
validateHistoricalData()
  .then(() => {
    logger.success('✅ Historical data validation completed');
  })
  .catch(error => {
    logger.error(`❌ Validation script failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });