#!/usr/bin/env tsx

/**
 * Delete Bot Script
 * 
 * Deletes a bot by ID for a specific Clerk user
 * 
 * Usage:
 *   pnpm tsx scripts/delete-bot.ts --userId=user_xxx --botId=bot-id
 *   pnpm tsx scripts/delete-bot.ts --help
 * 
 * Examples:
 *   # Delete a specific bot
 *   pnpm tsx scripts/delete-bot.ts --userId=user_2znyieHPBs2QVYWqDalHnjOYIwD --botId=my-bot-id
 * 
 *   # List all bots for a user first
 *   pnpm tsx scripts/delete-bot.ts --userId=user_2znyieHPBs2QVYWqDalHnjOYIwD --list
 */

import { config } from 'dotenv';
import { botService } from '../src/lib/services/bots/core/service.js';

// Load environment variables
config({ path: '.env.local' });

interface ScriptArgs {
  userId?: string;
  walletAddress?: string;
  botId?: string;
  list?: boolean;
  help?: boolean;
}

function parseArgs(): ScriptArgs {
  const args: ScriptArgs = {};
  
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--userId=')) {
      args.userId = arg.split('=')[1];
    } else if (arg.startsWith('--walletAddress=')) {
      args.walletAddress = arg.split('=')[1];
    } else if (arg.startsWith('--botId=')) {
      args.botId = arg.split('=')[1];
    } else if (arg === '--list') {
      args.list = true;
    } else if (arg === '--help') {
      args.help = true;
    }
  });
  
  return args;
}

function showHelp() {
  console.log(`
Delete Bot Script

Usage:
  pnpm tsx scripts/delete-bot.ts --userId=user_xxx --botId=bot-id
  pnpm tsx scripts/delete-bot.ts --userId=user_xxx --list
  pnpm tsx scripts/delete-bot.ts --help

Options:
  --userId=USER_ID    Clerk user ID (required)
  --botId=BOT_ID      Bot ID to delete (required for deletion)
  --list              List all bots for the user
  --help              Show this help message

Examples:
  # List all bots for a user
  pnpm tsx scripts/delete-bot.ts --userId=user_2znyieHPBs2QVYWqDalHnjOYIwD --list

  # Delete a specific bot
  pnpm tsx scripts/delete-bot.ts --userId=user_2znyieHPBs2QVYWqDalHnjOYIwD --botId=my-bot-id
`);
}

async function listUserBots(userId?: string, walletAddress?: string) {
  const identifier = userId || walletAddress;
  const type = userId ? 'Clerk user' : 'wallet address';
  
  console.log(`📋 Listing all bots for ${type}: ${identifier}`);
  
  try {
    const bots = userId 
      ? await botService.getAllBotsByClerkUserId(userId)
      : await botService.getAllBots(walletAddress!);
    
    if (bots.length === 0) {
      console.log(`❌ No bots found for this ${type}`);
      return;
    }
    
    console.log(`✅ Found ${bots.length} bot(s):\n`);
    
    bots.forEach((bot, index) => {
      console.log(`${index + 1}. ID: ${bot.id}`);
      console.log(`   Name: ${bot.name}`);
      console.log(`   Status: ${bot.status}`);
      console.log(`   Created: ${new Date(bot.createdAt).toLocaleString()}`);
      console.log(`   Updated: ${new Date(bot.updatedAt).toLocaleString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error listing bots:', error);
    process.exit(1);
  }
}

async function deleteBot(userId?: string, walletAddress?: string, botId?: string) {
  const identifier = userId || walletAddress;
  const type = userId ? 'Clerk user' : 'wallet address';
  
  console.log(`🗑️  Deleting bot ${botId} for ${type} ${identifier}...`);
  
  try {
    // First check if the bot exists
    const bot = userId 
      ? await botService.getBotByClerkUserId(userId, botId!)
      : await botService.getBot(walletAddress!, botId!);
    
    if (!bot) {
      console.error(`❌ Bot with ID "${botId}" not found for ${type} "${identifier}"`);
      console.log('\n💡 Tip: Use --list to see all available bots');
      process.exit(1);
    }
    
    console.log(`📄 Found bot: "${bot.name}" (${bot.status})`);
    console.log(`⚠️  This action cannot be undone!`);
    
    // In a real implementation, you might want to add a confirmation prompt
    // For now, we'll proceed directly
    
    if (userId) {
      await botService.deleteBotByClerkUserId(userId, botId!);
    } else {
      await botService.deleteBot(walletAddress!, botId!);
    }
    
    console.log(`✅ Successfully deleted bot "${bot.name}" (${botId})`);
    
  } catch (error) {
    console.error('❌ Error deleting bot:', error);
    process.exit(1);
  }
}

async function main() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    return;
  }
  
  if (!args.userId && !args.walletAddress) {
    console.error('❌ Error: Either --userId or --walletAddress is required');
    console.log('Use --help for usage information');
    process.exit(1);
  }
  
  if (args.list) {
    await listUserBots(args.userId, args.walletAddress);
    return;
  }
  
  if (!args.botId) {
    console.error('❌ Error: --botId is required for deletion');
    console.log('Use --list to see available bots, or --help for usage information');
    process.exit(1);
  }
  
  await deleteBot(args.userId, args.walletAddress, args.botId);
}

// Run the script
main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});