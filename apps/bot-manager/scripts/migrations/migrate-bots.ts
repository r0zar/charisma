#!/usr/bin/env node

/**
 * Migration script for moving static bot data to Vercel KV
 * 
 * Usage:
 *   pnpm script scripts/migrations/migrate-bots.ts --userId=user123
 *   pnpm script scripts/migrations/migrate-bots.ts --source=default --userId=user123
 *   pnpm script scripts/migrations/migrate-bots.ts --force --userId=user123
 *   pnpm script scripts/migrations/migrate-bots.ts --preview --userId=user123
 */

import path from 'path';
import fs from 'fs';
import { botDataStore, isKVAvailable } from '../../src/lib/kv-store';
import { appState } from '../../src/data/app-state';
import { defaultState } from '../../src/data/default-state';
import { syncLogger as logger } from '../logger';
import type { Bot } from '../../src/schemas/bot.schema';

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
  userId: string;
  source: 'app' | 'default';
  force: boolean;
  preview: boolean;
}

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    userId: '',
    source: 'app',
    force: false,
    preview: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--userId=')) {
      options.userId = arg.split('=')[1];
    } else if (arg.startsWith('--source=')) {
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
Migration script for moving static bot data to Vercel KV

Usage:
  pnpm script scripts/migrations/migrate-bots.ts [options]

Options:
  --userId=<string>       User ID to migrate bot data for (required)
  --source=<app|default>  Source data to migrate (default: app)
  --force                 Force migration even if KV store has existing data
  --preview               Show preview without migrating
  --help, -h              Show this help message

Examples:
  pnpm script scripts/migrations/migrate-bots.ts --userId=user123
  pnpm script scripts/migrations/migrate-bots.ts --source=default --userId=user123
  pnpm script scripts/migrations/migrate-bots.ts --force --userId=user123
  pnpm script scripts/migrations/migrate-bots.ts --preview --userId=user123
`);
      process.exit(0);
    }
  }

  if (!options.userId) {
    logger.error('userId is required. Use --userId=<string>');
    process.exit(1);
  }

  return options;
}

function showPreview(options: MigrationOptions) {
  const sourceData = options.source === 'default' ? defaultState : appState;
  const bots = sourceData.bots.list;

  logger.info(`📋 Migration Preview (source: ${options.source}, userId: ${options.userId})`);
  logger.info(`Bot data to migrate:`);

  if (!bots || bots.length === 0) {
    logger.info('No bot data found to migrate.');
    return;
  }

  logger.info(`  - Total bots: ${bots.length}`);
  
  // Bot status breakdown
  const statusCounts = bots.reduce((counts: Record<string, number>, bot) => {
    counts[bot.status] = (counts[bot.status] || 0) + 1;
    return counts;
  }, {});
  
  logger.info(`  - Bot statuses: ${Object.entries(statusCounts).map(([status, count]) => `${status}: ${count}`).join(', ')}`);
  
  // Strategy breakdown
  const strategyCounts = bots.reduce((counts: Record<string, number>, bot) => {
    const strategyKey = bot.strategy.substring(0, 50) + '...'; // Show first 50 chars
    counts[strategyKey] = (counts[strategyKey] || 0) + 1;
    return counts;
  }, {});
  
  logger.info(`  - Strategy types: ${Object.keys(strategyCounts).length} unique strategies`);
  
  // Show sample bot data
  if (bots.length > 0) {
    const sampleBot = bots[0];
    logger.info(`Sample bot: ${sampleBot.name} (${sampleBot.status})`);
    logger.info(`  - Wallet: ${sampleBot.walletAddress}`);
    logger.info(`  - STX Balance: ${sampleBot.stxBalance}`);
    logger.info(`  - Total P&L: ${sampleBot.totalPnL}`);
    logger.info(`  - Success Rate: ${sampleBot.successRate}%`);
    logger.info(`  - LP Token Balances: ${sampleBot.lpTokenBalances.length}`);
    logger.info(`  - Reward Token Balances: ${sampleBot.rewardTokenBalances.length}`);
  }
}

async function checkKVStatus(options: MigrationOptions) {
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

  logger.info('✅ KV store is available');

  // Check if bot data already exists
  const existingBots = await botDataStore.getAllBots(options.userId);
  
  if (existingBots.length > 0) {
    if (!options.force) {
      logger.error(`❌ KV store already contains bot data for user ${options.userId}:`);
      logger.error(`   - ${existingBots.length} bots`);
      logger.error('Use --force to overwrite existing data');
      process.exit(1);
    } else {
      logger.warn(`⚠️  KV store contains existing data for user ${options.userId}:`);
      logger.warn(`   - ${existingBots.length} bots`);
      logger.warn('Data will be overwritten due to --force flag');
    }
  } else {
    logger.info(`✅ No existing bot data found for user ${options.userId}`);
  }
}

async function validateBotData(bots: Bot[]): Promise<boolean> {
  logger.info('🔍 Validating bot data...');
  
  let isValid = true;
  const errors: string[] = [];
  
  // Validate bot data
  for (const bot of bots) {
    if (!bot.id || typeof bot.id !== 'string') {
      errors.push(`Bot missing or invalid id: ${JSON.stringify(bot.id)}`);
      isValid = false;
    }
    
    if (!bot.name || typeof bot.name !== 'string') {
      errors.push(`Bot ${bot.id} missing or invalid name`);
      isValid = false;
    }
    
    if (!bot.strategy || typeof bot.strategy !== 'string') {
      errors.push(`Bot ${bot.id} missing or invalid strategy`);
      isValid = false;
    }
    
    if (!['active', 'paused', 'error', 'inactive', 'setup'].includes(bot.status)) {
      errors.push(`Bot ${bot.id} has invalid status: ${bot.status}`);
      isValid = false;
    }
    
    if (!bot.walletAddress || !/^S[PT][0-9A-Z]{39}$/.test(bot.walletAddress)) {
      errors.push(`Bot ${bot.id} has invalid wallet address: ${bot.walletAddress}`);
      isValid = false;
    }
    
    if (typeof bot.stxBalance !== 'number' || bot.stxBalance < 0) {
      errors.push(`Bot ${bot.id} has invalid STX balance: ${bot.stxBalance}`);
      isValid = false;
    }
  }
  
  if (!isValid) {
    logger.error('❌ Bot data validation failed:');
    errors.forEach(error => logger.error(`   - ${error}`));
    return false;
  }
  
  logger.info(`✅ Bot data validation passed:`);
  logger.info(`   - ${bots.length} bots validated`);
  
  return true;
}

async function migrateBotData(options: MigrationOptions) {
  const sourceData = options.source === 'default' ? defaultState : appState;
  const bots = sourceData.bots.list;

  logger.info(`🚀 Starting bot data migration for user ${options.userId}...`);
  
  // Validate data before migration
  const isValid = await validateBotData(bots);
  if (!isValid) {
    logger.error('❌ Migration aborted due to validation errors');
    process.exit(1);
  }

  try {
    // Clear existing data if force flag is set
    if (options.force) {
      logger.info('🧹 Clearing existing bot data...');
      await botDataStore.clearUserData(options.userId);
    }

    // Migrate bots
    logger.info(`📦 Migrating ${bots.length} bots...`);
    await botDataStore.bulkImportBots(options.userId, bots);


    // Verify migration
    logger.info('🔍 Verifying migration...');
    const migratedBots = await botDataStore.getAllBots(options.userId);

    if (migratedBots.length !== bots.length) {
      throw new Error(`Bot count mismatch: expected ${bots.length}, got ${migratedBots.length}`);
    }

    // Generate final stats
    const stats = await botDataStore.getBotStats(options.userId);

    logger.info('✅ Bot data migration completed successfully!');
    logger.info(`📊 Migration Summary:`);
    logger.info(`   - Bots migrated: ${migratedBots.length}`);
    logger.info(`   - Active bots: ${stats.activeBots}`);
    logger.info(`   - Total value: $${stats.totalValue.toFixed(2)}`);
    logger.info(`   - Total P&L: $${stats.totalPnL.toFixed(2)}`);
    
    logger.info(`🎯 Next steps:`);
    logger.info(`   1. Update configuration to enable bot APIs`);
    logger.info(`   2. Test bot management features`);
    logger.info(`   3. Verify real-time updates work correctly`);

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    
    // Attempt to clean up on failure
    try {
      logger.info('🧹 Cleaning up partial migration...');
      await botDataStore.clearUserData(options.userId);
      logger.info('✅ Cleanup completed');
    } catch (cleanupError) {
      logger.error('❌ Cleanup failed:', cleanupError);
    }
    
    process.exit(1);
  }
}

async function main() {
  const options = parseArgs();

  logger.info('🤖 Bot Data Migration Tool');
  logger.info(`Source: ${options.source}`);
  logger.info(`User ID: ${options.userId}`);
  logger.info(`Force: ${options.force}`);
  logger.info(`Preview: ${options.preview}`);
  logger.info('');

  if (options.preview) {
    showPreview(options);
    return;
  }

  await checkKVStatus(options);
  await migrateBotData(options);
}

// Run the migration
main().catch((error) => {
  logger.error('❌ Migration script failed:', error);
  process.exit(1);
});