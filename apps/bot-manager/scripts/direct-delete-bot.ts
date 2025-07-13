#!/usr/bin/env tsx

/**
 * Direct Delete Bot Script - bypasses service layer
 */

import { config } from 'dotenv';
import { botDataStore } from '../src/lib/modules/storage/index.js';

// Load environment variables
config({ path: '.env.local' });

async function directDeleteBot() {
  const botId = 'SP3XB72K1QSTXN5WDN0PAJ2ZY99BQX22NB777RF6N';
  const walletAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
  const clerkUserId = 'user_2znyieHPBs2QVYWqDalHnjOYIwD';
  
  console.log(`🗑️  Attempting to delete bot ${botId}...`);
  
  try {
    // Try to get the bot first
    const bot = await botDataStore.getBot(walletAddress, botId);
    
    if (!bot) {
      console.error(`❌ Bot not found`);
      return;
    }
    
    console.log(`📄 Found bot: "${bot.name}" (${bot.status})`);
    console.log(`⚠️  Deleting bot...`);
    
    // Delete from both wallet-based and clerk-based storage
    await botDataStore.deleteBot(walletAddress, botId);
    await botDataStore.deleteBotByClerkUserId(clerkUserId, botId);
    
    console.log(`✅ Successfully deleted bot "${bot.name}" (${botId})`);
    
  } catch (error) {
    console.error('❌ Error deleting bot:', error);
  }
}

directDeleteBot();