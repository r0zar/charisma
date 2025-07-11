#!/usr/bin/env node

/**
 * Migration script for moving static notifications to Vercel KV
 * 
 * Usage:
 *   pnpm script scripts/migrations/migrate-notifications.ts
 *   pnpm script scripts/migrations/migrate-notifications.ts --source=default
 *   pnpm script scripts/migrations/migrate-notifications.ts --force
 */

import path from 'path';
import fs from 'fs';
import { notificationStore } from '../../src/lib/infrastructure/storage';
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
Migration script for moving static notifications to Vercel KV

Usage:
  pnpm script scripts/migrations/migrate-notifications.ts [options]

Options:
  --userId=<string>       User ID to migrate notifications for (required)
  --source=<app|default>  Source data to migrate (default: app)
  --force                 Force migration even if KV store has existing data
  --preview               Show preview without migrating
  --help, -h              Show this help message

Examples:
  pnpm script scripts/migrations/migrate-notifications.ts --userId=user123
  pnpm script scripts/migrations/migrate-notifications.ts --userId=user123 --source=default
  pnpm script scripts/migrations/migrate-notifications.ts --userId=user123 --force
  pnpm script scripts/migrations/migrate-notifications.ts --userId=user123 --preview
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
  const notifications = sourceData.notifications;

  logger.info(`📋 Migration Preview (source: ${options.source}, userId: ${options.userId})`);
  logger.info(`Total notifications to migrate: ${notifications.length}`);

  if (notifications.length === 0) {
    logger.info('No notifications to migrate.');
    return;
  }

  const counts = {
    unread: notifications.filter(n => !n.read).length,
    byType: {
      success: notifications.filter(n => n.type === 'success').length,
      error: notifications.filter(n => n.type === 'error').length,
      warning: notifications.filter(n => n.type === 'warning').length,
      info: notifications.filter(n => n.type === 'info').length,
    },
    byPriority: {
      high: notifications.filter(n => n.type === 'error').length, // Map error to high priority
      medium: notifications.filter(n => n.type === 'warning' || n.type === 'info').length, // Map warning/info to medium
      low: notifications.filter(n => n.type === 'success').length, // Map success to low priority
    },
  };

  logger.info(`Unread: ${counts.unread}/${notifications.length}`);
  logger.info(`By type: ${Object.entries(counts.byType).map(([type, count]) => `${type}: ${count}`).join(', ')}`);
  logger.info(`By priority: ${Object.entries(counts.byPriority).map(([priority, count]) => `${priority}: ${count}`).join(', ')}`);

  logger.info('Sample notifications:');
  const sampleNotifications = notifications.slice(0, 3);
  for (let i = 0; i < sampleNotifications.length; i++) {
    const notif = sampleNotifications[i];
    logger.info(`  ${i + 1}. [${notif.type.toUpperCase()}] ${notif.title}`);
    logger.info(`     ${notif.message || 'No message'}`);
    logger.info(`     Read: ${notif.read}, Persistent: ${notif.persistent}`);
  }

  if (notifications.length > 3) {
    logger.info(`     ... and ${notifications.length - 3} more notifications`);
  }
}

async function checkKVStatus(options: MigrationOptions) {
  logger.info('🔍 Checking KV store status...');

  const existingCounts = await notificationStore.getNotificationCounts(options.userId);
  logger.info(`Existing notifications in KV for user ${options.userId}: ${existingCounts.total}`);

  if (existingCounts.total > 0) {
    logger.info(`  - Unread: ${existingCounts.unread}`);
    logger.info(`  - By type: ${Object.entries(existingCounts.byType).map(([type, count]) => `${type}: ${count}`).join(', ')}`);
    logger.info(`  - By priority: ${Object.entries(existingCounts.byPriority).map(([priority, count]) => `${priority}: ${count}`).join(', ')}`);
  }

  return existingCounts.total;
}

async function performMigration(options: MigrationOptions) {
  const sourceData = options.source === 'default' ? defaultState : appState;

  logger.info(`🚀 Starting migration from ${options.source} state for user ${options.userId}...`);

  try {
    const success = await notificationStore.migrateFromStatic(options.userId, sourceData.notifications);

    if (success) {
      logger.success('Migration completed successfully!');

      const newCounts = await notificationStore.getNotificationCounts(options.userId);
      logger.info(`📊 Migration Results:`);
      logger.info(`Total notifications migrated: ${newCounts.total}`);
      logger.info(`Unread notifications: ${newCounts.unread}`);
      logger.info(`By type: ${Object.entries(newCounts.byType).map(([type, count]) => `${type}: ${count}`).join(', ')}`);
      logger.info(`By priority: ${Object.entries(newCounts.byPriority).map(([priority, count]) => `${priority}: ${count}`).join(', ')}`);
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

  logger.info('🔄 Notification Migration Tool');
  logger.info(`User ID: ${options.userId}`);
  logger.info(`Source: ${options.source}`);
  logger.info(`Force: ${options.force}`);
  logger.info(`Preview: ${options.preview}`);

  // Check KV store status
  const existingCount = await checkKVStatus(options);

  // Show preview of what will be migrated
  showPreview(options);

  // If preview only, exit
  if (options.preview) {
    logger.info('👁️  Preview complete. Use without --preview to perform migration.');
    return;
  }

  // Check if we need to force migration
  if (existingCount > 0 && !options.force) {
    logger.warn('KV store already contains notifications.');
    logger.warn('Use --force to overwrite existing notifications.');
    process.exit(1);
  }

  // Perform the migration
  await performMigration(options);

  logger.success('🎉 Migration complete!');
  logger.info('Next steps:');
  logger.info('1. Set NEXT_PUBLIC_ENABLE_API_NOTIFICATIONS=true in your environment');
  logger.info('2. Restart your application');
  logger.info(`3. Test the notifications API at /api/v1/notifications?userId=${options.userId}`);
}

// Run the script
main().catch(error => {
  logger.error(`Script failed: ${error}`);
  process.exit(1);
});