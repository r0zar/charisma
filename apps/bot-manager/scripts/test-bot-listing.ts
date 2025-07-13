#!/usr/bin/env tsx

/**
 * Test Bot Listing Script
 * 
 * Tests the bot service listing functionality to debug why we're getting 0 bots
 */

// Load environment variables first
import './utils/env';

import { syncLogger } from './utils/logger';
import { botService } from '../src/lib/services/bots/core/service';

async function main(): Promise<void> {
  syncLogger.info('Testing bot service listing...');

  try {
    // Check if bot service is available
    if (!botService.useKV) {
      syncLogger.error('Bot service is not available (ENABLE_API_BOTS not set)');
      process.exit(1);
    }

    // Set admin context for testing
    const testUserId = 'user_2znyieHPBs2QVYWqDalHnjOYIwD';
    botService.setAdminContext(testUserId);

    syncLogger.info('Attempting to list all bots...');
    
    try {
      const allBots = await botService.listBots();
      syncLogger.success(`✅ Successfully listed ${allBots.length} bots`);
      
      if (allBots.length > 0) {
        // Show ownership distribution
        const ownerCounts: Record<string, number> = {};
        allBots.forEach(bot => {
          ownerCounts[bot.ownerId] = (ownerCounts[bot.ownerId] || 0) + 1;
        });
        
        syncLogger.info('Ownership distribution:', ownerCounts);
        
        // Show sample bots
        const sampleBots = allBots.slice(0, 5).map(bot => ({
          name: bot.name,
          id: bot.id,
          ownerId: bot.ownerId,
          status: bot.status
        }));
        
        syncLogger.info('Sample bots:', sampleBots);
        
        // Check for specific Pokemon
        const pikachu = allBots.find(bot => bot.name === 'Pikachu');
        const mew = allBots.find(bot => bot.name === 'Mew');
        
        if (pikachu) {
          syncLogger.info('Found Pikachu:', { id: pikachu.id, owner: pikachu.ownerId });
        }
        if (mew) {
          syncLogger.info('Found Mew:', { id: mew.id, owner: mew.ownerId });
        }
      } else {
        syncLogger.warn('No bots returned - investigating...');
        
        // Try listing with different options
        syncLogger.info('Trying to list bots for specific user...');
        const userBots = await botService.listBots({ ownerId: testUserId });
        syncLogger.info(`User-specific listing returned: ${userBots.length} bots`);
        
        if (userBots.length > 0) {
          syncLogger.info('Sample user bots:', userBots.slice(0, 3).map(bot => ({
            name: bot.name,
            id: bot.id
          })));
        }
      }
      
    } catch (listError) {
      syncLogger.error('Failed to list bots:', {
        error: listError instanceof Error ? listError.message : 'Unknown error',
        stack: listError instanceof Error ? listError.stack : undefined
      });
      
      if (listError instanceof Error && listError.message.includes('validation failed')) {
        syncLogger.error('Bot validation error detected - there may be corrupted bot data in the database');
      }
    }

  } catch (error) {
    syncLogger.error('Script execution failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  } finally {
    // Clear admin context
    botService.clearAdminContext();
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