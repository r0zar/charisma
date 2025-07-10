#!/usr/bin/env node

/**
 * Clear market data from Vercel KV store
 * 
 * Usage:
 *   pnpm script scripts/migrations/clear-market.ts
 *   pnpm script scripts/migrations/clear-market.ts --confirm
 */

import path from 'path';
import fs from 'fs';
import { marketDataStore, isKVAvailable } from '../../src/lib/kv-store';
import { syncLogger as logger } from '../logger';

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            const cleanValue = value.replace(/^["']|["']$/g, '');
            process.env[key.trim()] = cleanValue;
          }
        }
      }
      console.log(`ℹ️  Loaded environment variables from ${envPath}`);
    } else {
      console.warn(`⚠️  Environment file not found: ${envPath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to load environment file: ${error}`);
  }
}

function parseArgs(): { confirm: boolean } {
  const args = process.argv.slice(2);
  const options = { confirm: false };

  for (const arg of args) {
    if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--help' || arg === '-h') {
      logger.info(`
Clear market data from Vercel KV store

Usage:
  pnpm script scripts/migrations/clear-market.ts [options]

Options:
  --confirm               Actually clear the data (required for safety)
  --help, -h              Show this help message

Examples:
  pnpm script scripts/migrations/clear-market.ts --confirm
`);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  loadEnvFile();

  const options = parseArgs();

  logger.info('🧹 Market Data Clear Tool');

  // Check KV store status
  logger.info('🔍 Checking KV store status...');
  const kvAvailable = await isKVAvailable();
  if (!kvAvailable) {
    logger.error('KV store is not available. Please check your configuration.');
    logger.error('Make sure you have:');
    logger.error('- KV_REST_API_URL environment variable set');
    logger.error('- KV_REST_API_TOKEN environment variable set');
    logger.error('- Valid Vercel KV credentials');
    process.exit(1);
  }

  logger.success('KV store is available');

  // Get current market data
  const currentMarketData = await marketDataStore.getMarketData();
  const hasMarketData = currentMarketData !== null;

  if (!hasMarketData) {
    logger.info('No market data found in KV store.');
    return;
  }

  logger.info(`Current market data in KV:`);
  logger.info(`  - Token Prices: ${Object.keys(currentMarketData.tokenPrices).length} tokens`);
  logger.info(`  - Price Changes: ${Object.keys(currentMarketData.priceChanges).length} tokens`);
  logger.info(`  - Market Cap: ${Object.keys(currentMarketData.marketCap).length} tokens`);

  if (!options.confirm) {
    logger.warn('⚠️  This will permanently delete market data from the KV store.');
    logger.warn('⚠️  Add --confirm flag to actually clear the data.');
    logger.info('Usage: pnpm script scripts/migrations/clear-market.ts --confirm');
    return;
  }

  // Perform the clear
  logger.info('🗑️  Clearing market data...');
  
  try {
    const success = await marketDataStore.clearMarketData();
    
    if (success) {
      logger.success('Market data cleared successfully!');
      
      // Verify the clear
      const newMarketData = await marketDataStore.getMarketData();
      
      if (newMarketData === null) {
        logger.success('✅ KV store market data is now empty');
      } else {
        logger.warn(`⚠️  Market data still exists in KV store`);
      }
    } else {
      logger.error('Failed to clear market data. Check the logs for details.');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Clear operation failed: ${error}`);
    process.exit(1);
  }

  logger.success('🎉 Clear operation complete!');
}

// Run the script
main().catch(error => {
  logger.error(`Script failed: ${error}`);
  process.exit(1);
});