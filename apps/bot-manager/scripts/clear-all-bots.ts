#!/usr/bin/env tsx

/**
 * Clear All Bots Script
 * 
 * Deletes ALL bots from the system (use with caution!)
 */

import { config } from 'dotenv';
import { botDataStore } from '../src/lib/modules/storage/index.js';

// Load environment variables
config({ path: '.env.local' });

async function clearAllBots() {
  console.log('🗑️  CLEARING ALL BOTS FROM SYSTEM...');
  console.log('⚠️  This will delete ALL bots for ALL users!');
  
  try {
    // Get all bots first
    const allBots = await botDataStore.getAllBotsPublic();
    console.log(`📊 Found ${allBots.length} total bots to delete`);
    
    if (allBots.length === 0) {
      console.log('✅ No bots found - system is already clean');
      return;
    }
    
    // Group by owner for organized deletion
    const botsByOwner = new Map<string, any[]>();
    allBots.forEach(bot => {
      if (!botsByOwner.has(bot.ownerId)) {
        botsByOwner.set(bot.ownerId, []);
      }
      botsByOwner.get(bot.ownerId)!.push(bot);
    });
    
    console.log(`👥 Found bots for ${botsByOwner.size} different owners`);
    
    let deletedCount = 0;
    
    // Delete bots for each owner
    for (const [ownerId, bots] of Array.from(botsByOwner.entries())) {
      console.log(`\n🗑️  Deleting ${bots.length} bots for owner: ${ownerId.substring(0, 20)}...`);
      
      for (const bot of bots) {
        try {
          // Delete from wallet-based storage
          await botDataStore.deleteBot(ownerId, bot.id);
          
          // Delete from clerk-based storage if clerkUserId exists
          if (bot.clerkUserId && bot.clerkUserId !== 'NOT SET') {
            await botDataStore.deleteBotByClerkUserId(bot.clerkUserId, bot.id);
          }
          
          console.log(`    ✅ Deleted: ${bot.name} (${bot.id.substring(0, 20)}...)`);
          deletedCount++;
        } catch (error) {
          console.log(`    ❌ Failed to delete ${bot.name}: ${error}`);
        }
      }
    }
    
    console.log(`\n🎉 Successfully deleted ${deletedCount} bots!`);
    console.log('💯 System cleared and ready for fresh bots');
    
  } catch (error) {
    console.error('❌ Error clearing bots:', error);
    process.exit(1);
  }
}

clearAllBots();