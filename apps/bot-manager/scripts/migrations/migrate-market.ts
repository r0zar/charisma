#!/usr/bin/env node

/**
 * Migration script for moving static market data to Vercel KV
 * 
 * Usage:
 *   pnpm script scripts/migrations/migrate-market.ts
 *   pnpm script scripts/migrations/migrate-market.ts --source=default
 *   pnpm script scripts/migrations/migrate-market.ts --force
 */

import path from 'path';
import fs from 'fs';
import { marketDataStore, isKVAvailable } from '../../src/lib/kv-store';
import { appState } from '../../src/data/app-state';
import { defaultState } from '../../src/data/default-state';
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
            // Remove quotes if present
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

// Load environment variables before doing anything else
loadEnvFile();

interface MigrationOptions {
  source: 'app' | 'default';
  force: boolean;
  preview: boolean;
}

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    source: 'app',
    force: false,
    preview: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--source=')) {
      const source = arg.split('=')[1];
      if (source === 'app' || source === 'default') {
        options.source = source;
      } else {
        logger.error('Invalid source. Use "app" or "default"');
        process.exit(1);
      }
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--preview') {
      options.preview = true;
    } else if (arg === '--help' || arg === '-h') {
      logger.info(`
Migration script for moving static market data to Vercel KV

Usage:
  pnpm script scripts/migrations/migrate-market.ts [options]

Options:
  --source=<app|default>  Source data to migrate (default: app)
  --force                 Force migration even if KV store has existing data
  --preview               Show preview without migrating
  --help, -h              Show this help message

Examples:
  pnpm script scripts/migrations/migrate-market.ts
  pnpm script scripts/migrations/migrate-market.ts --source=default
  pnpm script scripts/migrations/migrate-market.ts --force
  pnpm script scripts/migrations/migrate-market.ts --preview
`);
      process.exit(0);
    }
  }

  return options;
}

function showPreview(options: MigrationOptions) {
  const sourceData = options.source === 'default' ? defaultState : appState;
  const marketData = sourceData.market.data;

  logger.info(`📋 Migration Preview (source: ${options.source})`);
  logger.info(`Market data to migrate:`);

  if (!marketData) {
    logger.info('No market data found to migrate.');
    return;
  }

  logger.info(`  - Token Prices: ${Object.keys(marketData.tokenPrices).length} tokens`);
  logger.info(`  - Price Changes: ${Object.keys(marketData.priceChanges).length} tokens`);
  logger.info(`  - Market Cap: ${Object.keys(marketData.marketCap).length} tokens`);
  
  // Show sample data
  const sampleTokens = Object.keys(marketData.tokenPrices).slice(0, 3);
  logger.info(`Sample tokens: ${sampleTokens.join(', ')}`);
  
  sampleTokens.forEach(token => {
    const price = marketData.tokenPrices[token];
    const change = marketData.priceChanges[token];
    const cap = marketData.marketCap[token];
    logger.info(`  - ${token}: $${price}, ${change > 0 ? '+' : ''}${change}%, Cap: $${cap}`);
  });
}

async function checkKVStatus() {
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

  const existingMarketData = await marketDataStore.getMarketData();
  const hasExisting = existingMarketData !== null;
  
  if (hasExisting) {
    logger.info(`Existing market data in KV:`);
    logger.info(`  - Token Prices: ${Object.keys(existingMarketData.tokenPrices).length} tokens`);
    logger.info(`  - Price Changes: ${Object.keys(existingMarketData.priceChanges).length} tokens`);
    logger.info(`  - Market Cap: ${Object.keys(existingMarketData.marketCap).length} tokens`);
  } else {
    logger.info('No existing market data found in KV store');
  }

  return hasExisting;
}

async function performMigration(options: MigrationOptions) {
  const sourceData = options.source === 'default' ? defaultState : appState;

  logger.info(`🚀 Starting migration from ${options.source} state...`);

  try {
    const success = await marketDataStore.migrateFromStatic(sourceData.market.data);

    if (success) {
      logger.success('Migration completed successfully!');

      const newMarketData = await marketDataStore.getMarketData();
      logger.info(`📊 Migration Results:`);
      logger.info(`Market data migrated:`);
      logger.info(`  - Token Prices: ${Object.keys(newMarketData!.tokenPrices).length} tokens`);
      logger.info(`  - Price Changes: ${Object.keys(newMarketData!.priceChanges).length} tokens`);
      logger.info(`  - Market Cap: ${Object.keys(newMarketData!.marketCap).length} tokens`);
    } else {
      logger.error('Migration failed. Check the logs for details.');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Migration failed with error: ${error}`);
    process.exit(1);
  }
}

async function main() {
  const options = parseArgs();

  logger.info('🔄 Market Data Migration Tool');
  logger.info(`Source: ${options.source}`);
  logger.info(`Force: ${options.force}`);
  logger.info(`Preview: ${options.preview}`);

  // Check KV store status
  const hasExisting = await checkKVStatus();

  // Show preview of what will be migrated
  showPreview(options);

  // If preview only, exit
  if (options.preview) {
    logger.info('👁️  Preview complete. Use without --preview to perform migration.');
    return;
  }

  // Check if we need to force migration
  if (hasExisting && !options.force) {
    logger.warn('KV store already contains market data.');
    logger.warn('Use --force to overwrite existing market data.');
    process.exit(1);
  }

  // Perform the migration
  await performMigration(options);

  logger.success('🎉 Migration complete!');
  logger.info('Next steps:');
  logger.info('1. Set NEXT_PUBLIC_DATA_PHASE=phase2 in your environment');
  logger.info('2. Set NEXT_PUBLIC_ENABLE_API_MARKET=true');
  logger.info('3. Restart your application');
  logger.info('4. Test the market data API at /api/v1/market');
}

// Run the script
main().catch(error => {
  logger.error(`Script failed: ${error}`);
  process.exit(1);
});