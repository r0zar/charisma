#!/usr/bin/env node

/**
 * Migration script for moving static user data to Vercel KV
 * 
 * Usage:
 *   pnpm script scripts/migrations/migrate-user.ts
 *   pnpm script scripts/migrations/migrate-user.ts --userId=user123
 *   pnpm script scripts/migrations/migrate-user.ts --source=default --userId=user123
 *   pnpm script scripts/migrations/migrate-user.ts --force --userId=user123
 */

import path from 'path';
import fs from 'fs';
import { userDataStore } from '../../src/lib/infrastructure/storage';
import { appState } from '../../src/data/app-state';
import { defaultState } from '../../src/data/default-state';
import { syncLogger as logger } from '../utils/logger';

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
Migration script for moving static user data to Vercel KV

Usage:
  pnpm script scripts/migrations/migrate-user.ts [options]

Options:
  --userId=<string>       User ID to migrate data for (required)
  --source=<app|default>  Source data to migrate (default: app)
  --force                 Force migration even if KV store has existing data
  --preview               Show preview without migrating
  --help, -h              Show this help message

Examples:
  pnpm script scripts/migrations/migrate-user.ts --userId=user123
  pnpm script scripts/migrations/migrate-user.ts --source=default --userId=user123
  pnpm script scripts/migrations/migrate-user.ts --force --userId=user123
  pnpm script scripts/migrations/migrate-user.ts --preview --userId=user123
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
  const userData = sourceData.user;

  logger.info(`📋 Migration Preview (source: ${options.source}, userId: ${options.userId})`);
  logger.info(`User data to migrate:`);

  if (!userData) {
    logger.info('No user data found to migrate.');
    return;
  }

  logger.info(`  - Settings: ${Object.keys(userData.settings).length} sections`);
  logger.info(`  - Wallet: ${userData.wallet.isConnected ? 'Connected' : 'Disconnected'}`);
  logger.info(`  - Preferences: ${Object.keys(userData.preferences).length} preferences`);
  logger.info(`  - Wallet balance: ${userData.wallet.balance.tokens.length} tokens`);
  logger.info(`  - Transaction history: ${userData.wallet.transactions.length} transactions`);
  
  // Show sample data
  logger.info(`Settings sections: ${Object.keys(userData.settings).join(', ')}`);
  logger.info(`Wallet address: ${userData.wallet.address || 'Not set'}`);
  logger.info(`Preferred network: mainnet`); // Network is now managed globally
  logger.info(`Theme: ${userData.preferences.theme}`);
}

async function checkKVStatus(options: MigrationOptions) {
  logger.info('🔍 Checking KV store status...');

  const existingUserData = await userDataStore.getUserData(options.userId);
  const hasExisting = existingUserData !== null;
  
  if (hasExisting) {
    logger.info(`Existing user data in KV for user ${options.userId}:`);
    logger.info(`  - Settings: ${Object.keys(existingUserData.settings).length} sections`);
    logger.info(`  - Wallet: ${existingUserData.wallet.isConnected ? 'Connected' : 'Disconnected'}`);
    logger.info(`  - Preferences: ${Object.keys(existingUserData.preferences).length} preferences`);
    logger.info(`  - Wallet balance: ${existingUserData.wallet.balance.tokens.length} tokens`);
    logger.info(`  - Transaction history: ${existingUserData.wallet.transactions.length} transactions`);
  } else {
    logger.info(`No existing user data found in KV store for user ${options.userId}`);
  }

  return hasExisting;
}

async function performMigration(options: MigrationOptions) {
  const sourceData = options.source === 'default' ? defaultState : appState;

  logger.info(`🚀 Starting migration from ${options.source} state for user ${options.userId}...`);

  try {
    const success = await userDataStore.migrateFromStatic(options.userId, sourceData.user);

    if (success) {
      logger.success('Migration completed successfully!');

      const newUserData = await userDataStore.getUserData(options.userId);
      logger.info(`📊 Migration Results:`);
      logger.info(`User data migrated for user ${options.userId}:`);
      logger.info(`  - Settings: ${Object.keys(newUserData!.settings).length} sections`);
      logger.info(`  - Wallet: ${newUserData!.wallet.isConnected ? 'Connected' : 'Disconnected'}`);
      logger.info(`  - Preferences: ${Object.keys(newUserData!.preferences).length} preferences`);
      logger.info(`  - Wallet balance: ${newUserData!.wallet.balance.tokens.length} tokens`);
      logger.info(`  - Transaction history: ${newUserData!.wallet.transactions.length} transactions`);
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

  logger.info('👤 User Data Migration Tool');
  logger.info(`User ID: ${options.userId}`);
  logger.info(`Source: ${options.source}`);
  logger.info(`Force: ${options.force}`);
  logger.info(`Preview: ${options.preview}`);

  // Check KV store status
  const hasExisting = await checkKVStatus(options);

  // Show preview of what will be migrated
  showPreview(options);

  // If preview only, exit
  if (options.preview) {
    logger.info('👁️  Preview complete. Use without --preview to perform migration.');
    return;
  }

  // Check if we need to force migration
  if (hasExisting && !options.force) {
    logger.warn(`KV store already contains user data for user ${options.userId}.`);
    logger.warn('Use --force to overwrite existing user data.');
    process.exit(1);
  }

  // Perform the migration
  await performMigration(options);

  logger.success('🎉 Migration complete!');
  logger.info('Next steps:');
  logger.info('1. Set NEXT_PUBLIC_ENABLE_API_USER=true in your environment');
  logger.info('2. Restart your application');
  logger.info(`3. Test the user data API at /api/v1/user?userId=${options.userId}`);
}

// Run the script
main().catch(error => {
  logger.error(`Script failed: ${error}`);
  process.exit(1);
});