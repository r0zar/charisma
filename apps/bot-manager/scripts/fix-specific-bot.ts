#!/usr/bin/env tsx

/**
 * Fix Specific Legacy Bot Script
 * Targets the specific bot that's causing validation errors
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
  updatedAt?: string;
  [key: string]: any;
}

async function main(): Promise<void> {
  syncLogger.info('Starting targeted bot fix...');

  const problemBotId = 'SP19HWS2A4QNTJDM18B66KTQ90MYW42JY4SAJAH5N';
  const botKey = `bot-manager:bots:${problemBotId}`;

  try {
    // Get the specific bot
    const rawBot = await kv.get<LegacyBot>(botKey);
    
    if (!rawBot) {
      syncLogger.warn(`Bot ${problemBotId} not found in storage`);
      return;
    }

    syncLogger.info(`Found problematic bot: ${rawBot.name} (${rawBot.id})`);
    syncLogger.info('Current bot data:', rawBot);

    // Check if it needs fixing
    if (rawBot.clerkUserId === 'NOT SET' && !rawBot.ownerId) {
      syncLogger.warn(`Bot ${rawBot.id} has no valid owner (clerkUserId: "NOT SET") - deleting...`);
      await kv.del(botKey);
      syncLogger.success(`✅ Deleted bot ${rawBot.id} (${rawBot.name}) due to invalid owner`);
      return;
    }

    // If it has a valid clerkUserId, convert it to ownerId
    let needsUpdate = false;
    const updatedBot = { ...rawBot };

    if (rawBot.clerkUserId && rawBot.clerkUserId !== 'NOT SET' && !rawBot.ownerId) {
      updatedBot.ownerId = rawBot.clerkUserId;
      delete updatedBot.clerkUserId;
      needsUpdate = true;
      syncLogger.info(`Converting clerkUserId to ownerId: ${rawBot.clerkUserId}`);
    }

    // Remove legacy fields
    const legacyFields = ['clerkUserId', 'isScheduled', 'updatedAt'];
    for (const field of legacyFields) {
      if (updatedBot[field] !== undefined) {
        delete updatedBot[field];
        needsUpdate = true;
        syncLogger.info(`Removing legacy field: ${field}`);
      }
    }

    if (needsUpdate) {
      // Validate the updated bot
      try {
        const validatedBot = BotSchema.parse(updatedBot);
        await kv.set(botKey, validatedBot);
        syncLogger.success(`✅ Fixed and updated bot ${rawBot.id} (${rawBot.name})`);
        syncLogger.info('Updated bot data:', validatedBot);
      } catch (validationError) {
        syncLogger.error(`❌ Bot ${rawBot.id} failed validation after fixes:`, {
          error: validationError instanceof Error ? validationError.message : 'Unknown error',
          botData: updatedBot
        });
        
        // If we can't fix it, delete it
        syncLogger.warn(`Deleting unfixable bot ${rawBot.id}`);
        await kv.del(botKey);
        syncLogger.success(`✅ Deleted unfixable bot ${rawBot.id} (${rawBot.name})`);
      }
    } else {
      syncLogger.info(`Bot ${rawBot.id} doesn't need updates`);
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