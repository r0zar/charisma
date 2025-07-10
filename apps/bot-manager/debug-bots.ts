#!/usr/bin/env node

import { botDataStore } from './src/lib/infrastructure/storage';

async function debugBots() {
  console.log('🔍 Debugging bot data...');
  
  // Get all public bots to see what's in the store
  const allBots = await botDataStore.getAllBotsPublic();
  console.log(`Total bots found: ${allBots.length}`);
  
  // Group by owner
  const botsByOwner = allBots.reduce((acc, bot) => {
    if (!acc[bot.ownerId]) {
      acc[bot.ownerId] = [];
    }
    acc[bot.ownerId].push(bot);
    return acc;
  }, {} as Record<string, any[]>);
  
  console.log('\nBots by owner:');
  Object.entries(botsByOwner).forEach(([ownerId, bots]) => {
    console.log(`  ${ownerId}: ${bots.length} bots`);
  });
  
  // Check our target user specifically
  const targetUser = 'SP1HHRT2RXXYYWN1N14ZQVY7ZA2R6MJ82QXE4XY4N';
  const targetUserBots = await botDataStore.getAllBots(targetUser);
  console.log(`\nBots for target user ${targetUser}: ${targetUserBots.length}`);
  
  // Sample bot to check structure
  if (allBots.length > 0) {
    console.log('\nSample bot:');
    console.log(`  ID: ${allBots[0].id}`);
    console.log(`  Name: ${allBots[0].name}`);
    console.log(`  Owner: ${allBots[0].ownerId}`);
    console.log(`  Status: ${allBots[0].status}`);
  }
}

debugBots().catch(console.error);