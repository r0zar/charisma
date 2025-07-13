#!/usr/bin/env tsx

/**
 * Fix Corrupted Bot Data Script
 * 
 * Finds and fixes the specific bot with undefined ownerId that's causing validation errors
 */

// Load environment variables first
import './utils/env';

import { syncLogger } from './utils/logger';
import { kv } from '@vercel/kv';

const CORRUPTED_BOT_ID = 'SP19HWS2A4QNTJDM18B66KTQ90MYW42JY4SAJAH5N';

async function main(): Promise<void> {
  syncLogger.info('Investigating and fixing corrupted bot data...');

  try {
    // Get the corrupted bot data
    const botKey = `bot-manager:bots:${CORRUPTED_BOT_ID}`;
    const rawBot = await kv.get(botKey);
    
    if (!rawBot) {
      syncLogger.warn(`Bot ${CORRUPTED_BOT_ID} not found in storage`);
      return;
    }

    syncLogger.info('Found corrupted bot data:', {
      id: CORRUPTED_BOT_ID,
      data: rawBot
    });

    // Check if this bot has an undefined ownerId
    if (!rawBot.ownerId) {
      syncLogger.warn('Confirmed: Bot has undefined ownerId. This bot should be deleted as it\'s orphaned.');
      
      // Delete the corrupted bot since we can't determine the owner
      await kv.del(botKey);
      syncLogger.success(`✅ Deleted corrupted bot ${CORRUPTED_BOT_ID}`);
      
      // Also clean up any potential user indexes (though we don't know the user)
      // Check for any user indexes that might reference this bot
      const allIndexKeys = await kv.keys('bot-manager:user-index:*:owned-bots');
      let cleanedIndexes = 0;
      
      for (const indexKey of allIndexKeys) {
        try {
          const botIds = await kv.smembers(indexKey);
          if (botIds.includes(CORRUPTED_BOT_ID)) {
            await kv.srem(indexKey, CORRUPTED_BOT_ID);
            cleanedIndexes++;
            syncLogger.info(`Cleaned up reference in ${indexKey}`);
          }
        } catch (error) {
          syncLogger.warn(`Failed to check index ${indexKey}:`, error);
        }
      }
      
      if (cleanedIndexes > 0) {
        syncLogger.success(`✅ Cleaned up ${cleanedIndexes} user index references`);
      }
      
      // Check for any execution data for this orphaned bot
      const executionKeys = await kv.keys(`bot-manager:executions:*:${CORRUPTED_BOT_ID}:*`);
      if (executionKeys.length > 0) {
        syncLogger.info(`Found ${executionKeys.length} execution keys for orphaned bot, cleaning up...`);
        for (const key of executionKeys) {
          await kv.del(key);
        }
        syncLogger.success(`✅ Cleaned up ${executionKeys.length} execution keys`);
      }
      
    } else {
      syncLogger.info('Bot has ownerId:', rawBot.ownerId);
      syncLogger.info('This suggests a different validation issue. Let me check the full bot structure...');
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