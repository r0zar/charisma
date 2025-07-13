import { config } from 'dotenv';
import { botDataStore } from './src/lib/modules/storage/index.js';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function checkBots() {
  console.log('=== Checking all bots ===');
  const allBots = await botDataStore.getAllBotsPublic();
  console.log('Total bots found:', allBots.length);
  
  allBots.forEach(bot => {
    console.log(`Bot: ${bot.name}`);
    console.log(`  ID: ${bot.id}`);
    console.log(`  ownerId: ${bot.ownerId}`);
    console.log(`  clerkUserId: ${bot.clerkUserId || 'NOT SET'}`);
    console.log(`  status: ${bot.status}`);
    console.log('---');
  });
}

checkBots().catch(console.error);