#!/usr/bin/env node

/**
 * Migration script for moving static metadata to Vercel KV
 * 
 * Usage:
 *   pnpm script scripts/migrations/migrate-metadata.ts
 *   pnpm script scripts/migrations/migrate-metadata.ts --source=default
 *   pnpm script scripts/migrations/migrate-metadata.ts --force
 */

import path from 'path';
import fs from 'fs';
import { metadataStore, isKVAvailable } from '../../src/lib/kv-store';
import { appState } from '../../src/data/app-state';
import { defaultState } from '../../src/data/default-state';
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
  source: 'app' | 'default';
  force: boolean;
  preview: boolean;
}

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    source: 'app',
    force: false,
    preview: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--source=')) {
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
Migration script for moving static metadata to Vercel KV

Usage:
  pnpm script scripts/migrations/migrate-metadata.ts [options]

Options:
  --source=<app|default>  Source data to migrate (default: app)
  --force                 Force migration even if KV store has existing data
  --preview               Show preview without migrating
  --help, -h              Show this help message

Examples:
  pnpm script scripts/migrations/migrate-metadata.ts
  pnpm script scripts/migrations/migrate-metadata.ts --source=default
  pnpm script scripts/migrations/migrate-metadata.ts --force
  pnpm script scripts/migrations/migrate-metadata.ts --preview
`);
      process.exit(0);
    }
  }

  return options;
}

function showPreview(options: MigrationOptions) {
  const sourceData = options.source === 'default' ? defaultState : appState;
  const metadata = sourceData.metadata;

  logger.info(`📋 Migration Preview (source: ${options.source})`);
  logger.info(`Metadata to migrate:`);

  if (!metadata) {
    logger.info('No metadata found to migrate.');
    return;
  }

  logger.info(`  - Version: ${metadata.version}`);
  logger.info(`  - Generated: ${metadata.generatedAt}`);
  logger.info(`  - Profile: ${metadata.profile}`);
  logger.info(`  - Bot Count: ${metadata.botCount}`);
  logger.info(`  - Realistic Mode: ${metadata.realistic ? 'Enabled' : 'Disabled'}`);
  logger.info(`  - Seed: ${metadata.seed}`);
}

async function checkKVStatus() {
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

  const existingMetadata = await metadataStore.getMetadata();
  const hasExisting = existingMetadata !== null;
  
  if (hasExisting) {
    logger.info(`Existing metadata in KV:`);
    logger.info(`  - Version: ${existingMetadata.version}`);
    logger.info(`  - Generated: ${existingMetadata.generatedAt}`);
    logger.info(`  - Profile: ${existingMetadata.profile}`);
    logger.info(`  - Bot Count: ${existingMetadata.botCount}`);
    logger.info(`  - Realistic Mode: ${existingMetadata.realistic ? 'Enabled' : 'Disabled'}`);
    logger.info(`  - Seed: ${existingMetadata.seed}`);
  } else {
    logger.info('No existing metadata found in KV store');
  }

  return hasExisting;
}

async function performMigration(options: MigrationOptions) {
  const sourceData = options.source === 'default' ? defaultState : appState;

  logger.info(`🚀 Starting migration from ${options.source} state...`);

  try {
    const success = await metadataStore.migrateFromStatic(sourceData.metadata);

    if (success) {
      logger.success('Migration completed successfully!');

      const newMetadata = await metadataStore.getMetadata();
      logger.info(`📊 Migration Results:`);
      logger.info(`Metadata migrated:`);
      logger.info(`  - Version: ${newMetadata?.version}`);
      logger.info(`  - Generated: ${newMetadata?.generatedAt}`);
      logger.info(`  - Profile: ${newMetadata?.profile}`);
      logger.info(`  - Bot Count: ${newMetadata?.botCount}`);
      logger.info(`  - Realistic Mode: ${newMetadata?.realistic ? 'Enabled' : 'Disabled'}`);
      logger.info(`  - Seed: ${newMetadata?.seed}`);
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

  logger.info('🔄 Metadata Migration Tool');
  logger.info(`Source: ${options.source}`);
  logger.info(`Force: ${options.force}`);
  logger.info(`Preview: ${options.preview}`);

  // Check KV store status
  const hasExisting = await checkKVStatus();

  // Show preview of what will be migrated
  showPreview(options);

  // If preview only, exit
  if (options.preview) {
    logger.info('👁️  Preview complete. Use without --preview to perform migration.');
    return;
  }

  // Check if we need to force migration
  if (hasExisting && !options.force) {
    logger.warn('KV store already contains metadata.');
    logger.warn('Use --force to overwrite existing metadata.');
    process.exit(1);
  }

  // Perform the migration
  await performMigration(options);

  logger.success('🎉 Migration complete!');
  logger.info('Next steps:');
  logger.info('1. Set NEXT_PUBLIC_DATA_PHASE=phase1 in your environment');
  logger.info('2. Set NEXT_PUBLIC_ENABLE_API_METADATA=true');
  logger.info('3. Restart your application');
  logger.info('4. Test the metadata API at /api/v1/metadata');
}

// Run the script
main().catch(error => {
  logger.error(`Script failed: ${error}`);
  process.exit(1);
});