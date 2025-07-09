#!/usr/bin/env node

/**
 * Migration script to move transactions from legacy simple-swap queue to new tx-monitor service
 * Uses Node.js v22 with native TypeScript support
 * 
 * Usage: 
 *   - Dry run: node --import tsx scripts/migrate-legacy-transactions.ts
 *   - Live run: node --import tsx scripts/migrate-legacy-transactions.ts --live
 *   - Verbose: node --import tsx scripts/migrate-legacy-transactions.ts --verbose
 */

import { logger, logExecution, logResult, logError } from './logger.ts';
import { migrateLegacyTransactions } from '../src/lib/migration.ts';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const isLiveMode = args.includes('--live') || args.includes('-l');
const isVerbose = args.includes('--verbose') || args.includes('-v') || args.includes('--debug');
const showHelp = args.includes('--help') || args.includes('-h');

// Set verbosity
if (isVerbose) {
  process.env.LOG_LEVEL = 'debug';
}

// Show usage if requested
if (showHelp) {
  console.log(`
🔄 Transaction Migration Script (Node.js v22)
============================================

Usage:
  node --import tsx scripts/migrate-legacy-transactions.ts [options]

Options:
  --live, -l        Execute live migration (makes changes)
  --verbose, -v     Verbose output and debug logging
  --help, -h        Show this help message

Examples:
  node --import tsx scripts/migrate-legacy-transactions.ts                    # Dry run
  node --import tsx scripts/migrate-legacy-transactions.ts --live            # Live migration
  node --import tsx scripts/migrate-legacy-transactions.ts --live --verbose  # Live with debug logs

Output:
  - Console: Pretty-printed progress
  - Logs: Human-readable logs in logs/ directory
`);
  process.exit(0);
}

async function main() {
  // Load environment variables from .env.local
  const envFile = path.join(process.cwd(), '.env.local');
  try {
    const envExists = await fs.access(envFile).then(() => true).catch(() => false);
    if (envExists) {
      await logExecution('Loading environment variables', `Loading from ${envFile}`);
      const envContent = await fs.readFile(envFile, 'utf8');
      
      // Parse .env file manually for better control
      envContent.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#') && line.includes('=')) {
          const [key, ...valueParts] = line.split('=');
          const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
          process.env[key] = value;
        }
      });
      
      await logger.info('Environment variables loaded successfully');
    } else {
      await logger.warn('No .env.local file found, using system environment variables');
    }
  } catch (error) {
    await logger.warn(`Failed to load .env.local: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate required environment variables
  const requiredEnvVars = ['KV_REST_API_URL', 'KV_REST_API_TOKEN'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    await logError('Environment validation failed', new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`));
    process.exit(1);
  }

  await logger.info(`Starting migration in ${isLiveMode ? 'LIVE' : 'DRY RUN'} mode`);

  // Display mode banner
  if (isLiveMode) {
    console.log('\x1b[31m⚠️  LIVE MODE - Changes will be made to the database\x1b[0m');
    console.log('\x1b[33m   Make sure you have backups before proceeding\x1b[0m');
  } else {
    console.log('\x1b[34m🔍 DRY RUN MODE - No changes will be made\x1b[0m');
    console.log('\x1b[36m   Use --live flag to execute actual migration\x1b[0m');
  }

  console.log();
  console.log('\x1b[1m🔄 Transaction Migration Script (Node.js v22)\x1b[0m');
  console.log('\x1b[90m==============================================\x1b[0m');
  console.log();

  try {
    const startTime = Date.now();
    
    // Execute the migration using the imported migration function
    await logExecution('Running migration', `migrateLegacyTransactions(dryRun: ${!isLiveMode})`);
    
    const migrationResult = await migrateLegacyTransactions(!isLiveMode);
    const duration = Date.now() - startTime;
    
    await logResult('Migration execution', { exitCode: migrationResult.success ? 0 : 1, stdout: JSON.stringify(migrationResult.summary) }, duration);
    
    if (migrationResult.success) {
      await logger.success(`Migration completed successfully in ${duration}ms (${isLiveMode ? 'LIVE' : 'DRY_RUN'} mode)`);
      
      console.log();
      console.log('\x1b[32m✅ Migration completed successfully!\x1b[0m');
      console.log('\x1b[90m   Duration: ' + duration + 'ms\x1b[0m');
      
      // Display summary
      console.log();
      console.log('\x1b[34m📊 Migration Results\x1b[0m');
      console.log('\x1b[90m==================\x1b[0m');
      console.log('\x1b[36mStatus: ' + (migrationResult.success ? '✅ Success' : '❌ Failed') + '\x1b[0m');
      console.log('\x1b[36mOrders processed: ' + migrationResult.summary.ordersProcessed + '\x1b[0m');
      console.log('\x1b[36mBot activities processed: ' + migrationResult.summary.botActivitiesProcessed + '\x1b[0m');
      console.log('\x1b[36mTransactions migrated: ' + migrationResult.summary.transactionsMigrated + '\x1b[0m');
      console.log('\x1b[36mTransactions skipped: ' + migrationResult.summary.transactionsSkipped + '\x1b[0m');
      console.log('\x1b[36mErrors: ' + migrationResult.summary.errors.length + '\x1b[0m');
      
      if (migrationResult.summary.errors.length > 0) {
        console.log();
        console.log('\x1b[31m❌ Migration Errors:\x1b[0m');
        migrationResult.summary.errors.forEach(error => {
          console.log('\x1b[31m   - ' + error + '\x1b[0m');
        });
      }
      
      if (!isLiveMode) {
        console.log();
        console.log('\x1b[34m📋 Next Steps:\x1b[0m');
        console.log('\x1b[36m   1. Review the migration results above\x1b[0m');
        console.log('\x1b[36m   2. If everything looks correct, run with --live flag\x1b[0m');
        console.log('\x1b[36m   3. After successful migration, verify transactions in the dashboard\x1b[0m');
      } else {
        console.log();
        console.log('\x1b[34m📋 Post-Migration Steps:\x1b[0m');
        console.log('\x1b[36m   1. Verify migrated transactions in the tx-monitor dashboard\x1b[0m');
        console.log('\x1b[36m   2. Test the new monitoring system\x1b[0m');
        console.log('\x1b[36m   3. Consider cleanup of the old system (manual step)\x1b[0m');
      }
    } else {
      throw new Error(`Migration failed with ${migrationResult.summary.errors.length} errors`);
    }
    
  } catch (error) {
    await logError('Migration execution failed', error instanceof Error ? error : new Error(String(error)));
    
    console.log();
    console.log('\x1b[31m❌ Migration failed!\x1b[0m');
    console.log('\x1b[31m   Error: ' + (error instanceof Error ? error.message : String(error)) + '\x1b[0m');
    
    if (isVerbose && error instanceof Error) {
      console.log('\x1b[90m   Stack trace:\x1b[0m');
      console.log('\x1b[90m' + error.stack + '\x1b[0m');
    }
    
    process.exit(1);
  }

  await logger.info('Migration script completed');
}

// Execute main function
main().catch(async (error) => {
  await logError('Script execution failed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});