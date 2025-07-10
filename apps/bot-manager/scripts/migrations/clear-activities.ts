#!/usr/bin/env node

/**
 * Clear bot activities from Vercel KV store with advanced filtering
 * 
 * Usage:
 *   pnpm script scripts/migrations/clear-activities.ts --userId=user123 --confirm
 *   pnpm script scripts/migrations/clear-activities.ts --userId=user123 --botId=bot456 --confirm
 *   pnpm script scripts/migrations/clear-activities.ts --userId=user123 --type=failed --older-than=7d --dry-run
 */

import path from 'path';
import fs from 'fs';
import { botDataStore, isKVAvailable } from '../../src/lib/kv-store';
import { syncLogger as logger } from '../logger';
import type { BotActivity } from '../../src/schemas/bot.schema';

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
  botId?: string;
  type?: string;
  status?: string;
  olderThan?: number; // days
  confirm: boolean;
  dryRun: boolean;
}

function parseArgs(): ClearOptions {
  const args = process.argv.slice(2);
  const options: ClearOptions = { 
    userId: '',
    confirm: false, 
    dryRun: false 
  };

  for (const arg of args) {
    if (arg.startsWith('--userId=')) {
      options.userId = arg.split('=')[1];
    } else if (arg.startsWith('--botId=')) {
      options.botId = arg.split('=')[1];
    } else if (arg.startsWith('--type=')) {
      options.type = arg.split('=')[1];
    } else if (arg.startsWith('--status=')) {
      options.status = arg.split('=')[1];
    } else if (arg.startsWith('--older-than=')) {
      const value = arg.split('=')[1];
      const days = parseInt(value.replace(/d$/i, ''));
      if (isNaN(days)) {
        logger.error('Invalid --older-than value. Use format like --older-than=7d');
        process.exit(1);
      }
      options.olderThan = days;
    } else if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      logger.info(`
Clear bot activities from Vercel KV store with advanced filtering

Usage:
  pnpm script scripts/migrations/clear-activities.ts [options]

Options:
  --userId=<string>       User ID to clear activities for (required)
  --botId=<string>        Clear only activities for specific bot ID
  --type=<string>         Clear only activities of specific type (yield-farming|deposit|withdrawal|trade|error)
  --status=<string>       Clear only activities of specific status (pending|success|failed)
  --older-than=<days>     Clear only activities older than X days (e.g., --older-than=7d)
  --dry-run               Preview what would be cleared without actually deleting
  --confirm               Actually clear the data (required for safety)
  --help, -h              Show this help message

Examples:
  # Clear all activities for a user (dry run)
  pnpm script scripts/migrations/clear-activities.ts --userId=user123 --dry-run
  
  # Clear all activities for a user (confirm)
  pnpm script scripts/migrations/clear-activities.ts --userId=user123 --confirm
  
  # Clear activities for specific bot
  pnpm script scripts/migrations/clear-activities.ts --userId=user123 --botId=bot456 --confirm
  
  # Clear failed activities older than 7 days
  pnpm script scripts/migrations/clear-activities.ts --userId=user123 --status=failed --older-than=7d --confirm
  
  # Clear all trading activities
  pnpm script scripts/migrations/clear-activities.ts --userId=user123 --type=trade --confirm
`);
      process.exit(0);
    }
  }

  if (!options.userId) {
    logger.error('--userId=<string> is required');
    process.exit(1);
  }

  // Validate type if provided
  if (options.type && !['yield-farming', 'deposit', 'withdrawal', 'trade', 'error'].includes(options.type)) {
    logger.error('Invalid --type value. Must be: yield-farming, deposit, withdrawal, trade, or error');
    process.exit(1);
  }

  // Validate status if provided
  if (options.status && !['pending', 'success', 'failed'].includes(options.status)) {
    logger.error('Invalid --status value. Must be: pending, success, or failed');
    process.exit(1);
  }

  return options;
}

function filterActivities(activities: BotActivity[], options: ClearOptions): BotActivity[] {
  let filtered = activities;

  // Filter by bot ID
  if (options.botId) {
    filtered = filtered.filter(activity => activity.botId === options.botId);
  }

  // Filter by activity type
  if (options.type) {
    filtered = filtered.filter(activity => activity.type === options.type);
  }

  // Filter by status
  if (options.status) {
    filtered = filtered.filter(activity => activity.status === options.status);
  }

  // Filter by age
  if (options.olderThan) {
    const cutoffDate = new Date(Date.now() - options.olderThan * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(activity => new Date(activity.timestamp) < cutoffDate);
  }

  return filtered;
}

function showActivityBreakdown(activities: BotActivity[], title: string) {
  logger.info(`${title}: ${activities.length}`);
  
  if (activities.length === 0) return;

  // Show breakdown by type, status, and bot
  const typeBreakdown: Record<string, number> = {};
  const statusBreakdown: Record<string, number> = {};
  const botBreakdown: Record<string, number> = {};
  
  activities.forEach(activity => {
    typeBreakdown[activity.type] = (typeBreakdown[activity.type] || 0) + 1;
    statusBreakdown[activity.status] = (statusBreakdown[activity.status] || 0) + 1;
    botBreakdown[activity.botId] = (botBreakdown[activity.botId] || 0) + 1;
  });
  
  logger.info(`  - By type: ${Object.entries(typeBreakdown).map(([type, count]) => `${type}: ${count}`).join(', ')}`);
  logger.info(`  - By status: ${Object.entries(statusBreakdown).map(([status, count]) => `${status}: ${count}`).join(', ')}`);
  
  const topBots = Object.entries(botBreakdown)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([botId, count]) => `${botId}: ${count}`)
    .join(', ');
  logger.info(`  - Top bots: ${topBots}`);
}

async function main() {
  loadEnvFile();

  const options = parseArgs();

  logger.info('🧹 Bot Activity Clear Tool');
  logger.info(`Target: User ${options.userId}`);
  
  if (options.dryRun) {
    logger.info('Mode: DRY RUN (no actual deletion)');
  }

  // Show filters if any
  const filters = [];
  if (options.botId) filters.push(`botId: ${options.botId}`);
  if (options.type) filters.push(`type: ${options.type}`);
  if (options.status) filters.push(`status: ${options.status}`);
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

  // Get all activities for the user
  logger.info('📊 Analyzing current activities...');
  const allActivities = await botDataStore.getAllActivities(options.userId);
  
  showActivityBreakdown(allActivities, 'Total activities in KV store');

  if (allActivities.length === 0) {
    logger.info('No activities found for this user. Nothing to clear.');
    return;
  }

  // Apply filters
  const activitiesToDelete = filterActivities(allActivities, options);
  
  if (filters.length > 0) {
    showActivityBreakdown(activitiesToDelete, 'Activities matching filters');
  }

  if (activitiesToDelete.length === 0) {
    logger.info('No activities match the criteria. Nothing to clear.');
    return;
  }

  if (options.dryRun) {
    logger.info('🔍 DRY RUN: The following activities would be deleted:');
    
    // Show sample activities
    const sampleActivities = activitiesToDelete.slice(0, 10);
    sampleActivities.forEach(activity => {
      const timestamp = new Date(activity.timestamp).toLocaleString();
      logger.info(`  - [${activity.type}] ${activity.description || 'No description'} (${activity.status}) - Bot: ${activity.botId} - ${timestamp}`);
    });
    
    if (activitiesToDelete.length > 10) {
      logger.info(`  ... and ${activitiesToDelete.length - 10} more activities`);
    }
    
    logger.info('Use --confirm to actually delete these activities');
    return;
  }

  if (!options.confirm) {
    const target = filters.length > 0 ? 
      `${activitiesToDelete.length} filtered activities for user ${options.userId}` :
      `all ${activitiesToDelete.length} activities for user ${options.userId}`;
    
    logger.warn(`⚠️  This will permanently delete ${target} from the KV store.`);
    logger.warn('⚠️  Add --confirm flag to actually clear the data.');
    
    const currentCommand = process.argv.slice(2).join(' ');
    logger.info(`Usage: Add --confirm to your current command: ${currentCommand} --confirm`);
    return;
  }

  // Perform the deletion
  logger.info(`🗑️  Deleting ${activitiesToDelete.length} activities for user ${options.userId}...`);
  
  let deletedCount = 0;
  let failedCount = 0;
  
  for (const activity of activitiesToDelete) {
    try {
      const success = await botDataStore.deleteActivity(options.userId, activity.id);
      if (success) {
        deletedCount++;
        if (deletedCount % 10 === 0) {
          logger.info(`Progress: ${deletedCount}/${activitiesToDelete.length} activities deleted`);
        }
      } else {
        failedCount++;
      }
    } catch (error) {
      failedCount++;
      logger.error(`Failed to delete activity ${activity.id}: ${error}`);
    }
  }
  
  logger.success(`Deleted ${deletedCount} activities successfully!`);
  if (failedCount > 0) {
    logger.warn(`Failed to delete ${failedCount} activities`);
  }

  // Verify the operation
  const remainingActivities = await botDataStore.getAllActivities(options.userId);
  logger.info(`Verification: ${remainingActivities.length} activities remaining`);
  
  if (filters.length === 0 && remainingActivities.length === 0) {
    logger.success(`✅ All activities cleared for user ${options.userId}`);
  } else {
    logger.success(`✅ Clear operation completed for user ${options.userId}`);
  }

  logger.success('🎉 Activity clear operation complete!');
}

// Run the script
main().catch(error => {
  logger.error(`Script failed: ${error}`);
  process.exit(1);
});