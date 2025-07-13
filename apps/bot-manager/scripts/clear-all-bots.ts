#!/usr/bin/env tsx

/**
 * Clear All Bots Script
 * 
 * Removes all bots from the KV database including bot data and user ownership indexes.
 * Features dry-run mode and confirmation prompts for safety.
 * 
 * Usage:
 *   tsx scripts/clear-all-bots.ts [options]
 * 
 * Options:
 *   --dry-run           Preview operations without deleting bots
 *   --confirm           Skip confirmation prompt (use with caution)
 *   --owner-id <id>     Only delete bots owned by specific user
 *   --help              Show this help message
 */

// Load environment variables first
import './utils/env';

import { syncLogger } from './utils/logger';
import { botService } from '../src/lib/services/bots/core/service';
import { kv } from '@vercel/kv';
import { createInterface } from 'readline';

interface ScriptOptions {
  dryRun: boolean;
  confirm: boolean;
  ownerId?: string;
  help: boolean;
}

/**
 * Parse command line arguments
 */
function parseArguments(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    dryRun: false,
    confirm: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--confirm':
        options.confirm = true;
        break;
      case '--owner-id':
        options.ownerId = args[++i];
        break;
      case '--help':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          syncLogger.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
Clear All Bots Script

Removes all bots from the KV database including bot data and user ownership indexes.

Usage:
  tsx scripts/clear-all-bots.ts [options]

Options:
  --dry-run           Preview operations without deleting bots
  --confirm           Skip confirmation prompt (use with caution)
  --owner-id <id>     Only delete bots owned by specific user
  --help              Show this help message

Examples:
  # Dry run to preview what would be deleted
  tsx scripts/clear-all-bots.ts --dry-run

  # Delete all bots with confirmation
  tsx scripts/clear-all-bots.ts

  # Delete all bots owned by specific user
  tsx scripts/clear-all-bots.ts --owner-id user_123

  # Delete all bots without confirmation (dangerous!)
  tsx scripts/clear-all-bots.ts --confirm
`);
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Get all bot keys from KV
 */
async function getAllBotKeys(): Promise<string[]> {
  try {
    const keys = await kv.keys('bot-manager:bots:*');
    return keys;
  } catch (error) {
    syncLogger.error('Failed to get bot keys from KV', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return [];
  }
}

/**
 * Get all user index keys from KV
 */
async function getAllUserIndexKeys(): Promise<string[]> {
  try {
    const keys = await kv.keys('bot-manager:user-index:*');
    return keys;
  } catch (error) {
    syncLogger.error('Failed to get user index keys from KV', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return [];
  }
}

/**
 * Delete a single bot and its ownership records
 */
async function deleteBot(botId: string, ownerId: string, dryRun: boolean): Promise<boolean> {
  try {
    if (dryRun) {
      syncLogger.info(`[DRY RUN] Would delete bot ${botId} owned by ${ownerId}`);
      return true;
    }

    // Delete bot data and ownership record atomically
    await Promise.all([
      kv.del(`bot-manager:bots:${botId}`),
      kv.srem(`bot-manager:user-index:${ownerId}:owned-bots`, botId)
    ]);

    syncLogger.success(`Deleted bot ${botId}`);
    return true;
  } catch (error) {
    syncLogger.error(`Failed to delete bot ${botId}`, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Clean up orphaned user index keys
 */
async function cleanupOrphanedIndexes(dryRun: boolean): Promise<number> {
  const userIndexKeys = await getAllUserIndexKeys();
  let cleanedCount = 0;

  for (const key of userIndexKeys) {
    try {
      if (dryRun) {
        syncLogger.info(`[DRY RUN] Would check and potentially clean up index: ${key}`);
        cleanedCount++;
        continue;
      }

      // Check if the index has any bot IDs
      const botIds = await kv.smembers(key);
      if (!botIds || botIds.length === 0) {
        await kv.del(key);
        syncLogger.info(`Cleaned up empty user index: ${key}`);
        cleanedCount++;
      }
    } catch (error) {
      syncLogger.warn(`Failed to check user index ${key}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return cleanedCount;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const options = parseArguments();

  if (options.help) {
    showHelp();
    return;
  }

  // Check if bot service is available
  if (!botService.useKV) {
    syncLogger.error('Bot service is not available (ENABLE_API_BOTS not set)');
    process.exit(1);
  }

  syncLogger.info('Starting bot cleanup process...');

  // Get all bots
  const allBots = await botService.listBots();
  
  // Filter by owner if specified
  let botsToDelete = allBots;
  if (options.ownerId) {
    botsToDelete = allBots.filter(bot => bot.ownerId === options.ownerId);
    syncLogger.info(`Filtering to bots owned by: ${options.ownerId}`);
  }

  const totalCount = botsToDelete.length;

  if (totalCount === 0) {
    syncLogger.info('No bots found to delete');
    return;
  }

  // Show summary
  const operation = options.dryRun ? '[DRY RUN] Would delete' : 'Will delete';
  syncLogger.info(`${operation} ${totalCount} bots`, {
    totalBots: allBots.length,
    filteredBots: totalCount,
    ownerId: options.ownerId || 'all',
    dryRun: options.dryRun
  });

  // Show sample of bots to be deleted
  const sampleBots = botsToDelete.slice(0, 5);
  syncLogger.info('Sample bots to be deleted:', {
    sample: sampleBots.map(bot => ({
      id: bot.id,
      name: bot.name,
      ownerId: bot.ownerId,
      status: bot.status
    })),
    showing: `${sampleBots.length} of ${totalCount}`
  });

  // Confirmation prompt (unless --confirm flag is used)
  if (!options.confirm && !options.dryRun) {
    const confirmed = await promptConfirmation(
      `⚠️  This will permanently delete ${totalCount} bots. Are you sure?`
    );
    
    if (!confirmed) {
      syncLogger.info('Operation cancelled by user');
      return;
    }
  }

  // Delete bots
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < botsToDelete.length; i++) {
    const bot = botsToDelete[i];
    const progress = `(${i + 1}/${totalCount})`;
    
    syncLogger.info(`${progress} Processing ${bot.name} (${bot.id})...`);
    
    const success = await deleteBot(bot.id, bot.ownerId, options.dryRun);
    
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }

    // Small delay to avoid overwhelming the system
    if (!options.dryRun && i < botsToDelete.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // Clean up orphaned indexes
  syncLogger.info('Cleaning up orphaned user indexes...');
  const cleanedIndexes = await cleanupOrphanedIndexes(options.dryRun);

  // Final summary
  const operation_past = options.dryRun ? 'DRY RUN COMPLETED' : 'CLEANUP COMPLETED';
  syncLogger.success(`${operation_past}: Processed ${totalCount} bots`, {
    successful: successCount,
    failed: failureCount,
    total: totalCount,
    cleanedIndexes,
    ownerId: options.ownerId || 'all',
    dryRun: options.dryRun
  });

  if (failureCount > 0) {
    syncLogger.warn(`${failureCount} bots failed to delete. Check logs for details.`);
    process.exit(1);
  }
}

// Execute main function with error handling
main().catch((error) => {
  syncLogger.error('Script execution failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});