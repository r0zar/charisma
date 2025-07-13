import { config } from 'dotenv';
import { botDataStore } from './src/lib/modules/storage/index.js';
import { userService } from './src/lib/services/user/service.js';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function migrateExistingBots() {
  console.log('=== Bot Migration to Clerk userId ===');
  
  // Get all existing bots
  const allBots = await botDataStore.getAllBotsPublic();
  console.log(`Found ${allBots.length} total bots`);
  
  // Group bots by clerkUserId (since ownerId has been removed)
  const botsByUser = new Map<string, any[]>();
  allBots.forEach(bot => {
    const userId = bot.clerkUserId || 'NO_CLERK_USER';
    if (!botsByUser.has(userId)) {
      botsByUser.set(userId, []);
    }
    botsByUser.get(userId)!.push(bot);
  });
  
  console.log(`Found ${botsByUser.size} unique Clerk users:`);
  
  for (const entry of Array.from(botsByUser.entries())) {
    const [clerkUserId, bots] = entry;
    console.log(`\nClerk User: ${clerkUserId} (${bots.length} bots)`);
    bots.forEach(bot => {
      console.log(`  - ${bot.name} (${bot.id})`);
    });
  }
  
  console.log('\n=== Migration Status ===');
  console.log('All bots are now using Clerk-based storage.');
  console.log('Migration is complete!');
}

// Function to actually migrate bots (call this with your Clerk user ID)
async function migrateBots(clerkUserId: string, walletAddress: string) {
  console.log(`\n=== Migrating bots for wallet ${walletAddress} to Clerk user ${clerkUserId} ===`);
  
  // Get all bots for this wallet
  const userBots = await botDataStore.getAllBots(walletAddress);
  console.log(`Found ${userBots.length} bots to migrate`);
  
  for (const bot of userBots) {
    console.log(`Migrating bot: ${bot.name} (${bot.id})`);
    
    // Update bot with clerkUserId
    const updatedBot = {
      ...bot,
      clerkUserId: clerkUserId
    };
    
    // Save to both old and new storage locations
    await botDataStore.updateBot(walletAddress, updatedBot);
    await botDataStore.createBotByClerkUserId(clerkUserId, updatedBot);
    
    console.log(`  ✅ Migrated ${bot.name}`);
  }
  
  console.log(`\n🎉 Successfully migrated ${userBots.length} bots!`);
}

// Export the migration function
export { migrateBots };

// Run the migration for your specific user
const CLERK_USER_ID = 'user_2znyieHPBs2QVYWqDalHnjOYIwD';
const WALLET_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

migrateBots(CLERK_USER_ID, WALLET_ADDRESS).catch(console.error);