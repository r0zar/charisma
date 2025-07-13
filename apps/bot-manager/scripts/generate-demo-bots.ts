#!/usr/bin/env tsx

/**
 * Generate Demo Bots Script
 * 
 * Creates fresh demo bots for production launch
 */

import { config } from 'dotenv';
import { botDataStore } from '../src/lib/modules/storage/index.js';
import { generateBots } from './data/generators/bot-generator.js';
import { SeededRandom } from './data/generators/helpers.js';

// Load environment variables
config({ path: '.env.local' });

async function generateDemoBots() {
  console.log('🤖 GENERATING FRESH DEMO BOTS...');
  
  const yourClerkUserId = 'user_2znyieHPBs2QVYWqDalHnjOYIwD';
  const yourWalletAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
  
  try {
    // Create a seeded random generator for consistent results
    const rng = new SeededRandom('demo-bots-seed-v1');
    
    // Generate 5 bots for you
    console.log('🎯 Generating 5 bots for your account...');
    const yourBots = await generateBots(rng, {
      profile: 'demo',
      botCount: 5,
      targetWalletAddress: yourWalletAddress
    });
    
    // Save your bots with clerk userId
    for (const bot of yourBots) {
      const botWithClerkId = {
        ...bot,
        clerkUserId: yourClerkUserId,
        updatedAt: new Date().toISOString()
      };
      
      // Save to both wallet-based and clerk-based storage
      await botDataStore.updateBot(yourWalletAddress, botWithClerkId);
      await botDataStore.createBotByClerkUserId(yourClerkUserId, botWithClerkId);
      
      console.log(`    ✅ Created: ${bot.name} (${bot.status}) - ${bot.id.substring(0, 20)}...`);
    }
    
    // Generate 8-10 community bots from other "users"
    console.log('\n🌍 Generating community bots from other users...');
    
    const communityBotCount = 8;
    const communityBots = await generateBots(rng, {
      profile: 'demo',
      botCount: communityBotCount,
      // Let generator create random wallet addresses for diversity
    });
    
    // Save community bots (without clerk user IDs to simulate other users)
    for (const bot of communityBots) {
      const communityBot = {
        ...bot,
        clerkUserId: 'NOT SET', // Simulate old system users
        updatedAt: new Date().toISOString()
      };
      
      // Save to wallet-based storage only (simulating non-migrated users)
      await botDataStore.updateBot(bot.ownerId, communityBot);
      
      console.log(`    ✅ Created community bot: ${bot.name} (${bot.status}) - Owner: ${bot.ownerId.substring(0, 20)}...`);
    }
    
    const totalBots = yourBots.length + communityBots.length;
    console.log(`\n🎉 Successfully generated ${totalBots} demo bots!`);
    console.log(`👤 Your bots: ${yourBots.length}`);
    console.log(`🌍 Community bots: ${communityBots.length}`);
    
    // Show status breakdown
    const allBots = [...yourBots, ...communityBots];
    const statusCounts = allBots.reduce((acc, bot) => {
      acc[bot.status] = (acc[bot.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📊 Status breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`    ${status}: ${count} bots`);
    });
    
    console.log('\n🚀 Demo environment ready for launch!');
    
  } catch (error) {
    console.error('❌ Error generating demo bots:', error);
    process.exit(1);
  }
}

generateDemoBots();