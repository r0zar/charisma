#!/usr/bin/env node

/**
 * Clear user data from Vercel KV store
 * 
 * Usage:
 *   pnpm script scripts/migrations/clear-user.ts --userId=user123
 *   pnpm script scripts/migrations/clear-user.ts --userId=user123 --confirm
 */

import path from 'path';
import fs from 'fs';
import { userDataStore, isKVAvailable } from '../../src/lib/kv-store';
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

function parseArgs(): { userId: string; confirm: boolean } {
  const args = process.argv.slice(2);
  const options = { userId: '', confirm: false };

  for (const arg of args) {
    if (arg.startsWith('--userId=')) {
      options.userId = arg.split('=')[1];
    } else if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--help' || arg === '-h') {
      logger.info(`
Clear user data from Vercel KV store

Usage:
  pnpm script scripts/migrations/clear-user.ts [options]

Options:
  --userId=<string>       User ID to clear data for (required)
  --confirm               Actually clear the data (required for safety)
  --help, -h              Show this help message

Examples:
  pnpm script scripts/migrations/clear-user.ts --userId=user123 --confirm
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

async function main() {
  loadEnvFile();

  const options = parseArgs();

  logger.info('🧹 User Data Clear Tool');
  logger.info(`User ID: ${options.userId}`);

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

  // Get current user data
  const currentUserData = await userDataStore.getUserData(options.userId);
  const hasUserData = currentUserData !== null;

  if (!hasUserData) {
    logger.info(`No user data found in KV store for user ${options.userId}.`);
    return;
  }

  logger.info(`Current user data in KV for user ${options.userId}:`);
  logger.info(`  - Settings: ${Object.keys(currentUserData.settings).length} sections`);
  logger.info(`  - Wallet: ${currentUserData.wallet.isConnected ? 'Connected' : 'Disconnected'}`);
  logger.info(`  - Preferences: ${Object.keys(currentUserData.preferences).length} preferences`);
  logger.info(`  - Wallet balance: ${currentUserData.wallet.balance.tokens.length} tokens`);
  logger.info(`  - Transaction history: ${currentUserData.wallet.transactions.length} transactions`);

  if (!options.confirm) {
    logger.warn(`⚠️  This will permanently delete user data for user ${options.userId} from the KV store.`);
    logger.warn('⚠️  Add --confirm flag to actually clear the data.');
    logger.info(`Usage: pnpm script scripts/migrations/clear-user.ts --userId=${options.userId} --confirm`);
    return;
  }

  // Perform the clear
  logger.info(`🗑️  Clearing user data for user ${options.userId}...`);
  
  try {
    const success = await userDataStore.clearUserData(options.userId);
    
    if (success) {
      logger.success('User data cleared successfully!');
      
      // Verify the clear
      const newUserData = await userDataStore.getUserData(options.userId);
      
      if (newUserData === null) {
        logger.success(`✅ KV store user data for user ${options.userId} is now empty`);
      } else {
        logger.warn(`⚠️  User data for user ${options.userId} still exists in KV store`);
      }
    } else {
      logger.error('Failed to clear user data. Check the logs for details.');
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