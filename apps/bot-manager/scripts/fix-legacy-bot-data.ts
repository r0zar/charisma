#!/usr/bin/env tsx

/**
 * Fix Legacy Bot Data Script
 * 
 * Fixes bots with old schema format that have:
 * - clerkUserId instead of ownerId
 * - isScheduled field (which we're removing)
 * - Other legacy field issues
 */

// Load environment variables first
import './utils/env';

import { syncLogger } from './utils/logger';
import { kv } from '@vercel/kv';
import { BotSchema } from '../src/schemas/bot.schema';

interface LegacyBot {
  id: string;
  name: string;
  strategy: string;
  status: string;
  clerkUserId?: string;
  ownerId?: string;
  isScheduled?: boolean;
  [key: string]: any;
}

async function main(): Promise<void> {
  syncLogger.info('Starting legacy bot data cleanup...');

  try {
    // Get all bot keys
    const botKeys = await kv.keys('bot-manager:bots:*');
    syncLogger.info(`Found ${botKeys.length} bot keys to check`);

    let fixedCount = 0;
    let deletedCount = 0;
    let errorCount = 0;

    for (const key of botKeys) {
      // Skip index keys - they contain sets of bot IDs, not bot data
      if (key.includes(':index') || key.includes(':owned-bots')) {
        continue;
      }
      
      try {
        const rawBot = await kv.get<LegacyBot>(key);
        if (!rawBot) {
          syncLogger.warn(`No data found for key: ${key}`);
          continue;
        }

        let needsUpdate = false;
        const updatedBot = { ...rawBot };

        // Fix 1: Convert clerkUserId to ownerId
        if (rawBot.clerkUserId && !rawBot.ownerId) {
          if (rawBot.clerkUserId === 'NOT SET') {
            // This bot has no valid owner - it should be deleted
            syncLogger.warn(`Bot ${rawBot.id} (${rawBot.name}) has no valid owner - marking for deletion`);
            await kv.del(key);
            deletedCount++;
            continue;
          } else {
            updatedBot.ownerId = rawBot.clerkUserId;
            delete updatedBot.clerkUserId;
            needsUpdate = true;
            syncLogger.info(`Fixed ownerId for bot ${rawBot.id} (${rawBot.name})`);
          }
        }

        // Fix 2: Remove isScheduled field
        if (rawBot.isScheduled !== undefined) {
          delete updatedBot.isScheduled;
          needsUpdate = true;
          syncLogger.info(`Removed isScheduled field from bot ${rawBot.id} (${rawBot.name})`);
        }

        // Fix 3: Remove other legacy fields if they exist
        const legacyFields = ['clerkUserId', 'updatedAt'];
        for (const field of legacyFields) {
          if (updatedBot[field] !== undefined) {
            delete updatedBot[field];
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          // Validate the updated bot against current schema
          try {
            const validatedBot = BotSchema.parse(updatedBot);
            await kv.set(key, validatedBot);
            fixedCount++;
            syncLogger.success(`✅ Fixed and validated bot ${rawBot.id} (${rawBot.name})`);
          } catch (validationError) {
            syncLogger.error(`❌ Bot ${rawBot.id} (${rawBot.name}) failed validation after fixes:`, {
              error: validationError instanceof Error ? validationError.message : 'Unknown error',
              botData: updatedBot
            });
            errorCount++;
          }
        } else {
          // Check if bot is already valid
          try {
            BotSchema.parse(rawBot);
            syncLogger.info(`✓ Bot ${rawBot.id} (${rawBot.name}) is already valid`);
          } catch (validationError) {
            syncLogger.error(`❌ Bot ${rawBot.id} (${rawBot.name}) is invalid and couldn't be auto-fixed:`, {
              error: validationError instanceof Error ? validationError.message : 'Unknown error',
              botData: rawBot
            });
            errorCount++;
          }
        }

      } catch (error) {
        syncLogger.error(`Error processing key ${key}:`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        errorCount++;
      }
    }

    // Summary
    syncLogger.success(`🎉 Legacy bot data cleanup completed!`, {
      totalBots: botKeys.length,
      fixed: fixedCount,
      deleted: deletedCount,
      errors: errorCount,
      untouched: botKeys.length - fixedCount - deletedCount - errorCount
    });

    if (errorCount > 0) {
      syncLogger.warn(`${errorCount} bots had errors and may need manual review`);
    }

  } catch (error) {
    syncLogger.error('Script execution failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Execute main function
main().catch((error) => {
  syncLogger.error('Script execution failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});