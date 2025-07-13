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
  
  // Group bots by wallet address (ownerId)
  const botsByWallet = new Map<string, any[]>();
  allBots.forEach(bot => {
    if (!botsByWallet.has(bot.ownerId)) {
      botsByWallet.set(bot.ownerId, []);
    }
    botsByWallet.get(bot.ownerId)!.push(bot);
  });
  
  console.log(`Found ${botsByWallet.size} unique wallet addresses:`);
  
  for (const entry of Array.from(botsByWallet.entries())) {
    const [walletAddress, bots] = entry;
    console.log(`\nWallet: ${walletAddress} (${bots.length} bots)`);
    bots.forEach(bot => {
      console.log(`  - ${bot.name} (${bot.id})`);
    });
    
    // Try to find Clerk user by checking all users
    console.log(`  Searching for Clerk user with wallet: ${walletAddress}...`);
    
    // For now, let's manually map - you'll need to provide your Clerk user ID
    // We can get this from your current session or you can provide it
  }
  
  console.log('\n=== Manual Mapping Required ===');
  console.log('To complete the migration, please provide your Clerk user ID.');
  console.log('You can find this by:');
  console.log('1. Sign in to your app');  
  console.log('2. Open browser dev tools');
  console.log('3. Go to Application > Local Storage');
  console.log('4. Look for Clerk session data');
  console.log('\nOr run this in browser console while signed in:');
  console.log('window.__clerk_user?.id');
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