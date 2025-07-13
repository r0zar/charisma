/**
 * Seed Execution Logs Script
 * Generates realistic execution logs for development and testing
 * 
 * Usage:
 *   npm run seed-executions
 *   npm run seed-executions:demo
 *   node --import tsx scripts/execution/seed-execution-logs.ts --profile development
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { executionDataStore, botDataStore } from '@/lib/modules/storage';
import { generateExecutions, ExecutionGeneratorOptions } from './execution-generator';
import { SeededRandom } from '../data/generators/helpers';
import { syncLogger as logger } from '../utils/logger';

interface SeedOptions {
  profile: 'development' | 'testing' | 'demo' | 'production';
  userId?: string;
  executionCount?: number;
  daysPast?: number;
  seed?: number;
  generateBlobs?: boolean;
  clearFirst?: boolean;
}

// Profile configurations
const PROFILE_CONFIGS = {
  development: {
    executionCount: 50,
    daysPast: 7,
    generateBlobs: false, // Skip blob generation in dev to avoid API calls
  },
  testing: {
    executionCount: 20,
    daysPast: 3,
    generateBlobs: false,
  },
  demo: {
    executionCount: 100,
    daysPast: 30,
    generateBlobs: true, // Generate blobs for demo
  },
  production: {
    executionCount: 50, // Allow seeding for existing production bots
    daysPast: 14,
    generateBlobs: false,
  }
} as const;

/**
 * Main seeding function
 */
export async function seedExecutionLogs(options: SeedOptions = { profile: 'development' }) {
  const startTime = Date.now();

  logger.info('🌱 Starting execution logs seeding', {
    profile: options.profile,
    userId: options.userId,
    seed: options.seed
  });

  try {
    // Get profile configuration
    const config = PROFILE_CONFIGS[options.profile];
    const executionCount = options.executionCount ?? config.executionCount;
    const daysPast = options.daysPast ?? config.daysPast;
    const generateBlobs = options.generateBlobs ?? config.generateBlobs;

    // Validate profile - removed production restriction since we want to seed existing bots

    // Get or use default user ID
    const userId = options.userId ||
      process.env.NEXT_PUBLIC_DEFAULT_USER_ID ||
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

    // Clear existing executions if requested
    if (options.clearFirst) {
      logger.info('🧹 Clearing existing execution logs...');
      await clearAllExecutions(userId);
    }

    // Load available bots directly from KV store
    logger.info('🔍 Scanning for existing bots in KV store...');
    const allBots = await botDataStore.getAllBotsPublic();
    const botIds = allBots.map(bot => bot.id);

    logger.info(`🔍 Found ${allBots.length} bots total in KV`);

    if (botIds.length === 0) {
      logger.error('❌ No bots found. Please run bot generation first.');
      return;
    }

    logger.info(`📊 Found ${botIds.length} bots for execution generation`);
    logger.info(`📋 Bot IDs: ${botIds.slice(0, 3).join(', ')}${botIds.length > 3 ? '...' : ''}`);

    // Initialize seeded random generator
    const seed = options.seed ?? Date.now();
    const rng = new SeededRandom(seed);

    // Generate executions
    const generatorOptions: ExecutionGeneratorOptions = {
      userId,
      botIds,
      count: executionCount,
      daysPast,
      profile: options.profile,
      generateBlobs
    };

    const executions = await generateExecutions(rng, generatorOptions);

    // Store executions in KV
    logger.info('💾 Storing executions in KV storage...');
    let storedCount = 0;
    let failedCount = 0;

    for (const execution of executions) {
      try {
        const success = await executionDataStore.storeExecution(userId, execution);
        if (success) {
          storedCount++;
        } else {
          logger.error('Failed to store execution:', execution.id);
          failedCount++;
        }
      } catch (error) {
        logger.error('Exception storing execution:', execution.id, error);
        logger.error('Execution data:', JSON.stringify(execution, null, 2));
        failedCount++;
      }

      // Progress update every 25 executions
      if ((storedCount + failedCount) % 25 === 0) {
        logger.info(`Progress: ${storedCount}/${executions.length} stored`);
      }
    }

    const duration = Date.now() - startTime;

    logger.info('✅ Execution logs seeding complete!', {
      profile: options.profile,
      totalGenerated: executions.length,
      stored: storedCount,
      failed: failedCount,
      duration: `${duration}ms`,
      userId,
      seed,
      generateBlobs
    });

    // Summary stats
    const statusCounts = executions.reduce((acc, exec) => {
      acc[exec.status] = (acc[exec.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    logger.info('📈 Execution statistics:', statusCounts);

  } catch (error) {
    logger.error('❌ Execution seeding failed:', error);
    throw error;
  }
}

/**
 * Clear all executions for a user
 */
async function clearAllExecutions(userId: string) {
  try {
    const allBots = await botService.scanAllBots();
    let clearedCount = 0;

    for (const bot of allBots) {
      const success = await executionDataStore.clearExecutions(userId, bot.id);
      if (success) {
        clearedCount++;
      }
    }

    logger.info(`🗑️  Cleared executions for ${clearedCount} bots`);
  } catch (error) {
    logger.error('Failed to clear executions:', error);
    throw error;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);
  const options: SeedOptions = { profile: 'development' };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--profile':
        const profile = args[++i] as SeedOptions['profile'];
        if (['development', 'testing', 'demo', 'production'].includes(profile)) {
          options.profile = profile;
        } else {
          throw new Error(`Invalid profile: ${profile}`);
        }
        break;

      case '--user-id':
        options.userId = args[++i];
        break;

      case '--count':
        options.executionCount = parseInt(args[++i]);
        break;

      case '--days':
        options.daysPast = parseInt(args[++i]);
        break;

      case '--seed':
        options.seed = parseInt(args[++i]);
        break;

      case '--generate-blobs':
        options.generateBlobs = true;
        break;

      case '--clear-first':
        options.clearFirst = true;
        break;

      case '--help':
        console.log(`
Usage: node --import tsx scripts/execution/seed-execution-logs.ts [options]

Options:
  --profile <profile>    Profile: development|testing|demo|production (default: development)
  --user-id <id>         User ID for executions (default: env NEXT_PUBLIC_DEFAULT_USER_ID)
  --count <number>       Number of executions to generate (overrides profile default)
  --days <number>        Days in past to generate executions (overrides profile default)
  --seed <number>        Random seed for deterministic generation
  --generate-blobs       Generate blob storage logs (API calls required)
  --clear-first          Clear existing executions before seeding
  --help                 Show this help message

Examples:
  npm run seed-executions
  npm run seed-executions:demo
  node --import tsx scripts/execution/seed-execution-logs.ts --profile demo --count 50
  node --import tsx scripts/execution/seed-execution-logs.ts --clear-first --generate-blobs
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
      await seedExecutionLogs(options);
    } catch (error) {
      logger.error('Script failed:', error);
      process.exit(1);
    }
  })();
}