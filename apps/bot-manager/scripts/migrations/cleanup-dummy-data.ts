#!/usr/bin/env npx tsx

/**
 * Cleanup Dummy Data Script
 * 
 * This script removes dummy/fake data from bot records in the KV store,
 * resetting metrics to 0 so they can be populated with real blockchain data.
 * 
 * Usage:
 *   npx tsx scripts/migrations/cleanup-dummy-data.ts [options]
 * 
 * Options:
 *   --userId <userId>     Only clean bots for specific user
 *   --botId <botId>       Only clean specific bot
 *   --dry-run            Show what would be changed without making changes
 *   --confirm            Skip confirmation prompt
 *   --help               Show this help message
 */

import { BotKVStore, isKVAvailable } from '../../src/lib/kv-store';
import type { Bot } from '../../src/schemas/bot.schema';

interface CleanupOptions {
  userId?: string;
  botId?: string;
  dryRun: boolean;
  confirm: boolean;
}

interface CleanupStats {
  botsProcessed: number;
  botsUpdated: number;
  usersProcessed: number;
  errors: number;
}

const logger = {
  info: (message: string) => console.log(`ℹ️  ${message}`),
  success: (message: string) => console.log(`✅ ${message}`),
  warn: (message: string) => console.log(`⚠️  ${message}`),
  error: (message: string) => console.error(`❌ ${message}`),
  debug: (message: string) => console.log(`🔍 ${message}`)
};

function showHelp() {
  console.log(`
Cleanup Dummy Data Script

This script removes dummy/fake data from bot records in the KV store,
resetting metrics to 0 so they can be populated with real blockchain data.

Usage:
  npx tsx scripts/migrations/cleanup-dummy-data.ts [options]

Options:
  --userId <userId>     Only clean bots for specific user
  --botId <botId>       Only clean specific bot (requires --userId)
  --dry-run            Show what would be changed without making changes
  --confirm            Skip confirmation prompt
  --help               Show this help message

Examples:
  # Dry run to see what would be changed
  npx tsx scripts/migrations/cleanup-dummy-data.ts --dry-run

  # Clean all bots for a specific user
  npx tsx scripts/migrations/cleanup-dummy-data.ts --userId SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS

  # Clean specific bot
  npx tsx scripts/migrations/cleanup-dummy-data.ts --userId SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS --botId bot-123

  # Clean all bots (skip confirmation)
  npx tsx scripts/migrations/cleanup-dummy-data.ts --confirm
`);
}

function parseArgs(): CleanupOptions {
  const args = process.argv.slice(2);
  const options: CleanupOptions = {
    dryRun: false,
    confirm: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--userId':
        options.userId = args[++i];
        break;
      case '--botId':
        options.botId = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--confirm':
        options.confirm = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        logger.error(`Unknown option: ${args[i]}`);
        showHelp();
        process.exit(1);
    }
  }

  // Validate options
  if (options.botId && !options.userId) {
    logger.error('--botId requires --userId to be specified');
    process.exit(1);
  }

  return options;
}

function needsCleanup(bot: Bot): boolean {
  // Check if bot has dummy data that needs to be reset
  return (
    (bot.dailyPnL !== undefined && bot.dailyPnL !== 0) ||
    (bot.totalPnL !== undefined && bot.totalPnL !== 0) ||
    (bot.totalVolume !== undefined && bot.totalVolume !== 0) ||
    (bot.successRate !== undefined && bot.successRate !== 0) ||
    (bot.stxBalance !== undefined && bot.stxBalance !== 0) ||
    (bot.lpTokenBalances && bot.lpTokenBalances.length > 0) ||
    (bot.rewardTokenBalances && bot.rewardTokenBalances.length > 0)
  );
}

function cleanupBotData(bot: Bot): Bot {
  return {
    ...bot,
    // Reset all dummy metrics to 0
    dailyPnL: 0,
    totalPnL: 0,
    totalVolume: 0,
    successRate: 0,
    
    // Reset balance data (will be populated by real blockchain data)
    stxBalance: 0,
    lpTokenBalances: [],
    rewardTokenBalances: [],
    
    // Keep other properties as-is
    // (walletAddress, strategy, status, etc. should remain unchanged)
  };
}

function showSampleCleanup() {
  logger.info('');
  logger.info('📋 Sample Bot Cleanup (Demonstration)');
  logger.info('=====================================');
  
  // Sample bot with dummy data
  const sampleBot = {
    id: 'bot-sample-123',
    name: 'Sample Trading Bot',
    dailyPnL: -0.23,
    totalPnL: 15.67,
    totalVolume: 1250.00,
    successRate: 80.6,
    stxBalance: 9.48,
    lpTokenBalances: [{ token: 'LP-TOKEN', amount: 100 }],
    rewardTokenBalances: [{ token: 'REWARD-TOKEN', amount: 50 }]
  };

  logger.info(`Would update bot ${sampleBot.id} (${sampleBot.name}):`);
  logger.info(`  - dailyPnL: ${sampleBot.dailyPnL} → 0`);
  logger.info(`  - totalPnL: ${sampleBot.totalPnL} → 0`);
  logger.info(`  - totalVolume: ${sampleBot.totalVolume} → 0`);
  logger.info(`  - successRate: ${sampleBot.successRate} → 0`);
  logger.info(`  - stxBalance: ${sampleBot.stxBalance} → 0`);
  logger.info(`  - lpTokenBalances: ${sampleBot.lpTokenBalances.length} → 0 tokens`);
  logger.info(`  - rewardTokenBalances: ${sampleBot.rewardTokenBalances.length} → 0 tokens`);
  
  logger.info('');
  logger.info('📊 Sample Summary');
  logger.info('=================');
  logger.info('Users processed: 1');
  logger.info('Bots processed: 3 (example)');
  logger.info('Bots that would be updated: 3');
  logger.info('');
  logger.info('The script would reset all bot metrics to 0, allowing them to be');
  logger.info('populated with real blockchain data instead of dummy values.');
}

function logBotChanges(original: Bot, cleaned: Bot, dryRun: boolean) {
  const changes: string[] = [];
  
  if (original.dailyPnL !== cleaned.dailyPnL) {
    changes.push(`dailyPnL: ${original.dailyPnL} → ${cleaned.dailyPnL}`);
  }
  if (original.totalPnL !== cleaned.totalPnL) {
    changes.push(`totalPnL: ${original.totalPnL} → ${cleaned.totalPnL}`);
  }
  if (original.totalVolume !== cleaned.totalVolume) {
    changes.push(`totalVolume: ${original.totalVolume} → ${cleaned.totalVolume}`);
  }
  if (original.successRate !== cleaned.successRate) {
    changes.push(`successRate: ${original.successRate} → ${cleaned.successRate}`);
  }
  if (original.stxBalance !== cleaned.stxBalance) {
    changes.push(`stxBalance: ${original.stxBalance} → ${cleaned.stxBalance}`);
  }
  if ((original.lpTokenBalances?.length || 0) !== (cleaned.lpTokenBalances?.length || 0)) {
    changes.push(`lpTokenBalances: ${original.lpTokenBalances?.length || 0} → ${cleaned.lpTokenBalances?.length || 0} tokens`);
  }
  if ((original.rewardTokenBalances?.length || 0) !== (cleaned.rewardTokenBalances?.length || 0)) {
    changes.push(`rewardTokenBalances: ${original.rewardTokenBalances?.length || 0} → ${cleaned.rewardTokenBalances?.length || 0} tokens`);
  }

  if (changes.length > 0) {
    const action = dryRun ? 'Would update' : 'Updated';
    logger.info(`  ${action} bot ${original.id} (${original.name}):`);
    changes.forEach(change => logger.info(`    - ${change}`));
  }
}

async function promptConfirmation(): Promise<boolean> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question('Do you want to proceed with the cleanup? (y/N): ', (answer: string) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function cleanupUserBots(botStore: BotKVStore, userId: string, options: CleanupOptions): Promise<CleanupStats> {
  const stats: CleanupStats = {
    botsProcessed: 0,
    botsUpdated: 0,
    usersProcessed: 0,
    errors: 0
  };

  try {
    logger.info(`Processing bots for user: ${userId.slice(0, 8)}...`);
    
    let bots: Bot[];
    
    if (options.botId) {
      // Get specific bot
      const bot = await botStore.getBot(userId, options.botId);
      if (!bot) {
        logger.warn(`Bot ${options.botId} not found for user ${userId}`);
        return stats;
      }
      bots = [bot];
    } else {
      // Get all bots for user
      bots = await botStore.getAllBots(userId);
    }

    if (bots.length === 0) {
      logger.info(`No bots found for user ${userId}`);
      return stats;
    }

    logger.info(`Found ${bots.length} bot(s) for user ${userId.slice(0, 8)}...`);

    for (const bot of bots) {
      stats.botsProcessed++;
      
      if (needsCleanup(bot)) {
        const cleanedBot = cleanupBotData(bot);
        logBotChanges(bot, cleanedBot, options.dryRun);
        
        if (!options.dryRun) {
          try {
            await botStore.updateBot(userId, cleanedBot);
            stats.botsUpdated++;
          } catch (error) {
            logger.error(`Failed to update bot ${bot.id}: ${error}`);
            stats.errors++;
          }
        } else {
          stats.botsUpdated++; // Count what would be updated in dry run
        }
      } else {
        logger.debug(`Bot ${bot.id} (${bot.name}) already clean, skipping`);
      }
    }

    stats.usersProcessed = 1;
  } catch (error) {
    logger.error(`Error processing user ${userId}: ${error}`);
    stats.errors++;
  }

  return stats;
}

async function getAllUserIds(botStore: BotKVStore): Promise<string[]> {
  // This is a simplified approach - in a real implementation,
  // you might need to scan KV keys or maintain a user index
  logger.warn('Getting all user IDs - this is a simplified implementation');
  logger.warn('For production, you may need to maintain a user index or scan KV keys');
  
  // For now, return empty array - users should specify --userId
  return [];
}

async function main() {
  const options = parseArgs();
  
  logger.info('🧹 Bot Dummy Data Cleanup Script');
  logger.info('================================');
  
  if (options.dryRun) {
    logger.info('🔍 DRY RUN MODE - No changes will be made');
  }

  // Initialize KV store
  const botStore = new BotKVStore();
  
  try {
    // Check KV availability
    logger.info('Checking KV store availability...');
    const kvAvailable = await isKVAvailable();
    if (!kvAvailable) {
      logger.warn('KV store is not available in this environment.');
      logger.warn('This script needs to be run in an environment with Vercel KV configured.');
      logger.warn('Required environment variables: KV_REST_API_URL and KV_REST_API_TOKEN');
      
      if (options.dryRun) {
        logger.info('In dry-run mode, showing what the script would do with sample data...');
        showSampleCleanup();
        process.exit(0);
      } else {
        logger.error('Cannot proceed without KV store access.');
        process.exit(1);
      }
    }
    logger.success('KV store is available');

    let userIds: string[] = [];
    
    if (options.userId) {
      userIds = [options.userId];
    } else {
      logger.warn('No --userId specified. You must specify a user ID to clean their bots.');
      logger.warn('Use --help for usage information.');
      process.exit(1);
      
      // Alternative: scan all users (commented out for safety)
      // userIds = await getAllUserIds(botStore);
      // if (userIds.length === 0) {
      //   logger.info('No users found in KV store');
      //   process.exit(0);
      // }
    }

    logger.info(`Will process ${userIds.length} user(s)`);
    
    // Confirmation prompt
    if (!options.confirm && !options.dryRun) {
      const confirmed = await promptConfirmation();
      if (!confirmed) {
        logger.info('Cleanup cancelled by user');
        process.exit(0);
      }
    }

    // Process each user
    const totalStats: CleanupStats = {
      botsProcessed: 0,
      botsUpdated: 0,
      usersProcessed: 0,
      errors: 0
    };

    for (const userId of userIds) {
      const userStats = await cleanupUserBots(botStore, userId, options);
      totalStats.botsProcessed += userStats.botsProcessed;
      totalStats.botsUpdated += userStats.botsUpdated;
      totalStats.usersProcessed += userStats.usersProcessed;
      totalStats.errors += userStats.errors;
    }

    // Summary
    logger.info('');
    logger.info('📊 Cleanup Summary');
    logger.info('==================');
    logger.info(`Users processed: ${totalStats.usersProcessed}`);
    logger.info(`Bots processed: ${totalStats.botsProcessed}`);
    
    if (options.dryRun) {
      logger.info(`Bots that would be updated: ${totalStats.botsUpdated}`);
    } else {
      logger.success(`Bots updated: ${totalStats.botsUpdated}`);
    }
    
    if (totalStats.errors > 0) {
      logger.warn(`Errors encountered: ${totalStats.errors}`);
    }

    if (options.dryRun) {
      logger.info('');
      logger.info('To apply these changes, run the script again without --dry-run');
    } else if (totalStats.botsUpdated > 0) {
      logger.success('Cleanup completed successfully!');
      logger.info('Bot metrics have been reset and will be populated with real blockchain data.');
    } else {
      logger.info('No bots needed cleanup - all metrics are already clean.');
    }

  } catch (error) {
    logger.error(`Script failed: ${error}`);
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  logger.info('\nScript interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\nScript terminated');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    logger.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
}