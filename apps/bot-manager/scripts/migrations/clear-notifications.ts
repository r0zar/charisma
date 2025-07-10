#!/usr/bin/env node

/**
 * Clear all notifications from Vercel KV store
 * 
 * Usage:
 *   pnpm script scripts/migrations/clear-notifications.ts
 *   pnpm script scripts/migrations/clear-notifications.ts --confirm
 */

import path from 'path';
import fs from 'fs';
import { notificationStore, isKVAvailable } from '../../src/lib/kv-store';
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

interface ClearOptions {
  userId: string;
  allUsers: boolean;
  confirm: boolean;
  dryRun: boolean;
  type?: string;
  priority?: string;
  category?: string;
  olderThan?: number; // days
}

function parseArgs(): ClearOptions {
  const args = process.argv.slice(2);
  const options: ClearOptions = { 
    userId: '', 
    allUsers: false,
    confirm: false, 
    dryRun: false 
  };

  for (const arg of args) {
    if (arg.startsWith('--userId=')) {
      options.userId = arg.split('=')[1];
    } else if (arg === '--all-users') {
      options.allUsers = true;
    } else if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--type=')) {
      options.type = arg.split('=')[1];
    } else if (arg.startsWith('--priority=')) {
      options.priority = arg.split('=')[1];
    } else if (arg.startsWith('--category=')) {
      options.category = arg.split('=')[1];
    } else if (arg.startsWith('--older-than=')) {
      const value = arg.split('=')[1];
      const days = parseInt(value.replace(/d$/i, ''));
      if (isNaN(days)) {
        logger.error('Invalid --older-than value. Use format like --older-than=7d');
        process.exit(1);
      }
      options.olderThan = days;
    } else if (arg === '--help' || arg === '-h') {
      logger.info(`
Clear notifications from Vercel KV store with advanced filtering

Usage:
  pnpm script scripts/migrations/clear-notifications.ts [options]

Options:
  --userId=<string>       User ID to clear notifications for
  --all-users             Clear notifications for ALL users (admin only)
  --type=<string>         Clear only notifications of specific type (success|error|warning|info)
  --priority=<string>     Clear only notifications of specific priority (high|medium|low)
  --category=<string>     Clear only notifications of specific category
  --older-than=<days>     Clear only notifications older than X days (e.g., --older-than=7d)
  --dry-run               Preview what would be cleared without actually deleting
  --confirm               Actually clear the data (required for safety)
  --help, -h              Show this help message

Examples:
  # Clear all notifications for a user
  pnpm script scripts/migrations/clear-notifications.ts --userId=user123 --confirm
  
  # Clear only error notifications for a user
  pnpm script scripts/migrations/clear-notifications.ts --userId=user123 --type=error --confirm
  
  # Clear high priority notifications older than 7 days (dry run)
  pnpm script scripts/migrations/clear-notifications.ts --userId=user123 --priority=high --older-than=7d --dry-run
  
  # Clear all users' notifications (admin)
  pnpm script scripts/migrations/clear-notifications.ts --all-users --confirm
`);
      process.exit(0);
    }
  }

  if (!options.userId && !options.allUsers) {
    logger.error('Either --userId=<string> or --all-users is required');
    process.exit(1);
  }

  if (options.userId && options.allUsers) {
    logger.error('Cannot specify both --userId and --all-users');
    process.exit(1);
  }

  // Validate type if provided
  if (options.type && !['success', 'error', 'warning', 'info'].includes(options.type)) {
    logger.error('Invalid --type value. Must be: success, error, warning, or info');
    process.exit(1);
  }

  // Validate priority if provided
  if (options.priority && !['high', 'medium', 'low'].includes(options.priority)) {
    logger.error('Invalid --priority value. Must be: high, medium, or low');
    process.exit(1);
  }

  return options;
}

async function filterNotifications(userId: string, options: ClearOptions) {
  const filters: any = {};
  
  if (options.type) filters.type = options.type;
  if (options.category) filters.category = options.category;
  
  const notifications = await notificationStore.getNotifications(userId, { limit: 1000, ...filters });
  
  let filteredNotifications = notifications.notifications;
  
  // Apply client-side filtering for options not supported by KV store
  if (options.priority) {
    filteredNotifications = filteredNotifications.filter(n => n.priority === options.priority);
  }
  
  if (options.olderThan) {
    const cutoffDate = new Date(Date.now() - options.olderThan * 24 * 60 * 60 * 1000);
    filteredNotifications = filteredNotifications.filter(n => new Date(n.timestamp) < cutoffDate);
  }
  
  return filteredNotifications;
}

async function main() {
  loadEnvFile();

  const options = parseArgs();

  logger.info('🧹 Enhanced Notification Clear Tool');
  
  if (options.allUsers) {
    logger.info('Target: ALL USERS (Admin Mode)');
  } else {
    logger.info(`Target: User ${options.userId}`);
  }
  
  if (options.dryRun) {
    logger.info('Mode: DRY RUN (no actual deletion)');
  }

  // Show filters if any
  const filters = [];
  if (options.type) filters.push(`type: ${options.type}`);
  if (options.priority) filters.push(`priority: ${options.priority}`);
  if (options.category) filters.push(`category: ${options.category}`);
  if (options.olderThan) filters.push(`older than: ${options.olderThan} days`);
  
  if (filters.length > 0) {
    logger.info(`Filters: ${filters.join(', ')}`);
  }

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

  if (options.allUsers) {
    logger.warn('⚠️  ALL-USERS mode is not yet implemented');
    logger.warn('⚠️  This would require iterating through all KV keys');
    logger.info('For now, please use --userId=<specific-user>');
    process.exit(1);
  }

  // Get notifications to be cleared (with filtering)
  let notificationsToDelete;
  let currentCounts;
  
  if (filters.length > 0) {
    // Use filtered approach
    notificationsToDelete = await filterNotifications(options.userId, options);
    currentCounts = await notificationStore.getNotificationCounts(options.userId);
    
    logger.info(`Total notifications for user: ${currentCounts.total}`);
    logger.info(`Notifications matching filters: ${notificationsToDelete.length}`);
  } else {
    // Get all notifications
    currentCounts = await notificationStore.getNotificationCounts(options.userId);
    const allNotifications = await notificationStore.getNotifications(options.userId, { limit: 1000 });
    notificationsToDelete = allNotifications.notifications;
    
    logger.info(`Current notifications in KV for user ${options.userId}: ${currentCounts.total}`);
  }

  if (notificationsToDelete.length === 0) {
    logger.info('No notifications match the criteria. Nothing to clear.');
    return;
  }

  logger.info(`Found ${notificationsToDelete.length} notifications to delete:`);
  
  // Show breakdown by type and priority
  const typeBreakdown: Record<string, number> = {};
  const priorityBreakdown: Record<string, number> = {};
  
  notificationsToDelete.forEach(n => {
    typeBreakdown[n.type] = (typeBreakdown[n.type] || 0) + 1;
    priorityBreakdown[n.priority] = (priorityBreakdown[n.priority] || 0) + 1;
  });
  
  logger.info(`  - By type: ${Object.entries(typeBreakdown).map(([type, count]) => `${type}: ${count}`).join(', ')}`);
  logger.info(`  - By priority: ${Object.entries(priorityBreakdown).map(([priority, count]) => `${priority}: ${count}`).join(', ')}`);

  if (options.dryRun) {
    logger.info('🔍 DRY RUN: The following notifications would be deleted:');
    notificationsToDelete.slice(0, 10).forEach(n => {
      logger.info(`  - [${n.type}] ${n.title} (${n.priority} priority)`);
    });
    if (notificationsToDelete.length > 10) {
      logger.info(`  ... and ${notificationsToDelete.length - 10} more`);
    }
    logger.info('Use --confirm to actually delete these notifications');
    return;
  }

  if (!options.confirm) {
    const target = filters.length > 0 ? 
      `${notificationsToDelete.length} filtered notifications for user ${options.userId}` :
      `all notifications for user ${options.userId}`;
    
    logger.warn(`⚠️  This will permanently delete ${target} from the KV store.`);
    logger.warn('⚠️  Add --confirm flag to actually clear the data.');
    
    if (filters.length > 0) {
      logger.info(`Usage: Add --confirm to your current command`);
    } else {
      logger.info(`Usage: pnpm script scripts/migrations/clear-notifications.ts --userId=${options.userId} --confirm`);
    }
    return;
  }

  // Perform the clear
  if (filters.length > 0) {
    // Delete specific notifications
    logger.info(`🗑️  Deleting ${notificationsToDelete.length} filtered notifications for user ${options.userId}...`);
    
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const notification of notificationsToDelete) {
      try {
        const success = await notificationStore.deleteNotification(options.userId, notification.id);
        if (success) {
          deletedCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
        logger.error(`Failed to delete notification ${notification.id}: ${error}`);
      }
    }
    
    logger.success(`Deleted ${deletedCount} notifications successfully!`);
    if (failedCount > 0) {
      logger.warn(`Failed to delete ${failedCount} notifications`);
    }
  } else {
    // Clear all notifications
    logger.info(`🗑️  Clearing all notifications for user ${options.userId}...`);
    
    try {
      const success = await notificationStore.clearAll(options.userId);
      
      if (success) {
        logger.success('All notifications cleared successfully!');
      } else {
        logger.error('Failed to clear notifications. Check the logs for details.');
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Clear operation failed: ${error}`);
      process.exit(1);
    }
  }

  // Verify the operation
  const newCounts = await notificationStore.getNotificationCounts(options.userId);
  logger.info(`Verification: ${newCounts.total} notifications remaining`);
  
  if (filters.length === 0 && newCounts.total === 0) {
    logger.success(`✅ KV store is now empty for user ${options.userId}`);
  } else {
    logger.success(`✅ Clear operation completed for user ${options.userId}`);
  }

  logger.success('🎉 Clear operation complete!');
}

// Run the script
main().catch(error => {
  logger.error(`Script failed: ${error}`);
  process.exit(1);
});