/**
 * Clear Execution Logs Script
 * Safely clears execution logs from KV storage and optionally blob storage
 * 
 * Usage:
 *   npm run clear-executions
 *   npm run clear-executions:confirm
 *   node --import tsx scripts/execution/clear-execution-logs.ts --confirm
 */

// Using readline for confirmation prompts
import { executionDataStore } from '@/lib/modules/storage';
import { botService } from '@/lib/services/bots/service';
import { ExecutionLogService } from '@/lib/services/bots';
import { syncLogger as logger } from '../utils/logger';

interface ClearOptions {
  userId?: string;
  botId?: string;
  confirm?: boolean;
  clearBlobs?: boolean;
  dryRun?: boolean;
  olderThan?: number; // days
}

/**
 * Main clearing function
 */
export async function clearExecutionLogs(options: ClearOptions = {}) {
  const startTime = Date.now();
  
  logger.info('🧹 Starting execution logs cleanup', {
    userId: options.userId,
    botId: options.botId,
    clearBlobs: options.clearBlobs,
    dryRun: options.dryRun,
    olderThan: options.olderThan
  });

  try {
    // Get or use default user ID
    const userId = options.userId || 
                   process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 
                   'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

    // Get bots to clear
    const botsToProcess = await getBotsToProcess(userId, options.botId);
    
    if (botsToProcess.length === 0) {
      logger.warn('⚠️  No bots found to process');
      return;
    }

    // Count existing executions
    const counts = await countExecutions(userId, botsToProcess, options.olderThan);
    
    logger.info('📊 Found executions to clear:', {
      totalBots: botsToProcess.length,
      totalExecutions: counts.totalExecutions,
      withBlobs: counts.withBlobs,
      estimatedBlobSize: `${Math.round(counts.totalBlobSize / 1024)}KB`
    });

    if (counts.totalExecutions === 0) {
      logger.info('✅ No executions found to clear');
      return;
    }

    // Safety confirmation
    if (!options.confirm && !options.dryRun) {
      const confirmed = await confirmDeletion(counts, options);
      if (!confirmed) {
        logger.info('❌ Operation cancelled by user');
        return;
      }
    }

    if (options.dryRun) {
      logger.info('🔍 Dry run completed - no data was deleted');
      return;
    }

    // Clear executions
    const result = await performClearing(userId, botsToProcess, options);
    
    const duration = Date.now() - startTime;
    
    logger.info('✅ Execution logs clearing complete!', {
      ...result,
      duration: `${duration}ms`
    });

  } catch (error) {
    logger.error('❌ Execution clearing failed:', error);
    throw error;
  }
}

/**
 * Get bots to process based on options
 */
async function getBotsToProcess(userId: string, botId?: string): Promise<Array<{id: string, name: string}>> {
  if (botId) {
    // Single bot
    const allBots = await botService.scanAllBots();
    const bot = allBots.find(b => b.id === botId);
    return bot ? [{ id: bot.id, name: bot.name }] : [];
  } else {
    // All bots
    const allBots = await botService.scanAllBots();
    return allBots.map(bot => ({ id: bot.id, name: bot.name }));
  }
}

/**
 * Count executions to be cleared
 */
async function countExecutions(
  userId: string, 
  bots: Array<{id: string, name: string}>,
  olderThanDays?: number
) {
  let totalExecutions = 0;
  let withBlobs = 0;
  let totalBlobSize = 0;

  const cutoffDate = olderThanDays ? 
    new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) : 
    null;

  for (const bot of bots) {
    try {
      const executions = await executionDataStore.getExecutions(userId, bot.id, 1000);
      
      const filteredExecutions = cutoffDate ? 
        executions.filter(exec => new Date(exec.startedAt) < cutoffDate) :
        executions;

      totalExecutions += filteredExecutions.length;

      for (const execution of filteredExecutions) {
        if (execution.logsUrl) {
          withBlobs++;
          totalBlobSize += execution.logsSize || 0;
        }
      }
    } catch (error) {
      logger.warn(`Failed to count executions for bot ${bot.id}:`, error);
    }
  }

  return { totalExecutions, withBlobs, totalBlobSize };
}

/**
 * Confirm deletion with user
 */
async function confirmDeletion(counts: any, options: ClearOptions): Promise<boolean> {
  console.log('\n⚠️  EXECUTION LOGS DELETION CONFIRMATION ⚠️');
  console.log('================================================');
  console.log(`Executions to delete: ${counts.totalExecutions}`);
  console.log(`Blob logs to delete: ${counts.withBlobs}`);
  console.log(`Estimated blob size: ${Math.round(counts.totalBlobSize / 1024)}KB`);
  
  if (options.clearBlobs) {
    console.log('\n🗑️  Blob storage will also be cleared (irreversible)');
  }
  
  if (options.olderThan) {
    console.log(`📅 Only clearing executions older than ${options.olderThan} days`);
  }

  console.log('\nThis action cannot be undone!');
  
  // Use a simple prompt approach
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question('\nType "DELETE" to confirm, or anything else to cancel: ', (answer: string) => {
      readline.close();
      resolve(answer.trim() === 'DELETE');
    });
  });
}

/**
 * Perform the actual clearing operation
 */
async function performClearing(
  userId: string, 
  bots: Array<{id: string, name: string}>,
  options: ClearOptions
) {
  let clearedKV = 0;
  let clearedBlobs = 0;
  let failedKV = 0;
  let failedBlobs = 0;

  const cutoffDate = options.olderThan ? 
    new Date(Date.now() - options.olderThan * 24 * 60 * 60 * 1000) : 
    null;

  for (const bot of bots) {
    try {
      if (cutoffDate) {
        // Selective deletion - need to get executions first
        const executions = await executionDataStore.getExecutions(userId, bot.id, 1000);
        const toDelete = executions.filter(exec => new Date(exec.startedAt) < cutoffDate);

        for (const execution of toDelete) {
          // Delete blob if requested and exists
          if (options.clearBlobs && execution.logsUrl) {
            try {
              await ExecutionLogService.delete(execution.logsUrl);
              clearedBlobs++;
            } catch (error) {
              logger.warn(`Failed to delete blob for execution ${execution.id}:`, error);
              failedBlobs++;
            }
          }

          // Delete from KV
          try {
            await executionDataStore.deleteExecution(userId, bot.id, execution.id);
            clearedKV++;
          } catch (error) {
            logger.warn(`Failed to delete execution ${execution.id}:`, error);
            failedKV++;
          }
        }
      } else {
        // Clear all executions for bot
        if (options.clearBlobs) {
          // Get executions to clear blobs first
          const executions = await executionDataStore.getExecutions(userId, bot.id, 1000);
          
          for (const execution of executions) {
            if (execution.logsUrl) {
              try {
                await ExecutionLogService.delete(execution.logsUrl);
                clearedBlobs++;
              } catch (error) {
                logger.warn(`Failed to delete blob for execution ${execution.id}:`, error);
                failedBlobs++;
              }
            }
            clearedKV++;
          }
        }

        // Clear all KV data for bot
        const success = await executionDataStore.clearExecutions(userId, bot.id);
        if (!success) {
          failedKV++;
        }
      }

      logger.info(`✅ Cleared executions for bot: ${bot.name}`);
    } catch (error) {
      logger.error(`❌ Failed to clear executions for bot ${bot.name}:`, error);
      failedKV++;
    }
  }

  return {
    clearedKV,
    clearedBlobs,
    failedKV,
    failedBlobs
  };
}

/**
 * Parse command line arguments
 */
function parseArgs(): ClearOptions {
  const args = process.argv.slice(2);
  const options: ClearOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--user-id':
        options.userId = args[++i];
        break;
        
      case '--bot-id':
        options.botId = args[++i];
        break;
        
      case '--confirm':
        options.confirm = true;
        break;
        
      case '--clear-blobs':
        options.clearBlobs = true;
        break;
        
      case '--dry-run':
        options.dryRun = true;
        break;
        
      case '--older-than':
        options.olderThan = parseInt(args[++i]);
        break;
        
      case '--help':
        console.log(`
Usage: node --import tsx scripts/execution/clear-execution-logs.ts [options]

Options:
  --user-id <id>         User ID to clear executions for (default: env NEXT_PUBLIC_DEFAULT_USER_ID)
  --bot-id <id>          Clear executions for specific bot only
  --confirm              Skip confirmation prompt
  --clear-blobs          Also delete blob storage logs (requires API access)
  --dry-run              Show what would be deleted without actually deleting
  --older-than <days>    Only clear executions older than specified days
  --help                 Show this help message

Examples:
  npm run clear-executions
  npm run clear-executions:confirm
  node --import tsx scripts/execution/clear-execution-logs.ts --confirm --clear-blobs
  node --import tsx scripts/execution/clear-execution-logs.ts --dry-run --older-than 30
  node --import tsx scripts/execution/clear-execution-logs.ts --bot-id SP123... --confirm
`);
        process.exit(0);
        break;
    }
  }

  return options;
}

// Run the script if called directly
if (require.main === module) {
  (async () => {
    try {
      const options = parseArgs();
      await clearExecutionLogs(options);
    } catch (error) {
      logger.error('Script failed:', error);
      process.exit(1);
    }
  })();
}