#!/usr/bin/env ts-node

/**
 * Script to create a bot and save it to the database
 * Usage: pnpm run create-bot --name "Bot Name" --owner "SP1234..." --pokemon "Charmander"
 */

import { CreateBotRequest } from '../src/schemas/bot.schema';
import { createBotImageConfig } from '../src/lib/services/bots/assets';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : undefined;
};

const botName = getArg('--name');
const ownerAddress = getArg('--owner');
const pokemonName = getArg('--pokemon') || botName;
const strategy = getArg('--strategy');

if (!botName || !ownerAddress) {
  console.error('❌ Missing required arguments');
  console.error('Usage: pnpm run create-bot --name "Bot Name" --owner "SP1234..." [--pokemon "Charmander"] [--strategy "custom strategy"]');
  process.exit(1);
}

// Validate Stacks address format
const stacksAddressRegex = /^S[PT][0-9A-Z]{37,39}$/;
if (!stacksAddressRegex.test(ownerAddress)) {
  console.error('❌ Invalid Stacks address format for owner');
  process.exit(1);
}

async function createBot() {
  console.log(`🚀 Creating bot: ${botName}`);
  console.log(`👤 Owner: ${ownerAddress}`);
  console.log(`🎨 Pokemon: ${pokemonName}`);

  // Default migration strategy if none provided
  const defaultStrategy = `console.log('🚀 Starting strategy for', bot.name);

// Check if polyglot library is available
if (!bot.polyglot) {
  console.log('❌ Polyglot library not available');
  return;
}

console.log('✅ Polyglot library loaded');

try {
  // Get current bot wallet balance
  console.log('💰 Checking current bot wallet balance...');
  const botBalance = await bot.polyglot.getAccountBalances(bot.id);
  
  if (botBalance && botBalance.stx) {
    const stxBalance = parseFloat(botBalance.stx.balance) / 1000000; // Convert microSTX to STX
    console.log(\`💊 Current STX balance: \${stxBalance.toFixed(6)} STX\`);
  } else {
    console.log('⚠️  Could not retrieve wallet balance');
  }
  
  // Check for any fungible tokens
  if (botBalance && botBalance.fungible_tokens) {
    const tokens = Object.keys(botBalance.fungible_tokens);
    console.log(\`🪙 Found \${tokens.length} fungible token types\`);
    
    tokens.forEach(tokenId => {
      const tokenBalance = botBalance.fungible_tokens[tokenId];
      console.log(\`  - \${tokenId}: \${tokenBalance.balance}\`);
    });
  }
  
  // Check for any NFTs
  if (botBalance && botBalance.non_fungible_tokens) {
    const nfts = Object.keys(botBalance.non_fungible_tokens);
    console.log(\`🖼️  Found \${nfts.length} NFT types\`);
    
    nfts.forEach(nftId => {
      const nftBalance = botBalance.non_fungible_tokens[nftId];
      console.log(\`  - \${nftId}: \${nftBalance.count} items\`);
    });
  }
  
  console.log('✅ Bot check completed');
  
} catch (error) {
  console.log('❌ Bot operation failed:', error.message);
}`;

  const botRequest: CreateBotRequest = {
    name: botName!,
    strategy: strategy || defaultStrategy,
    // Use default polyglot repo configuration
    gitRepository: 'https://github.com/pointblankdev/charisma.git',
    isMonorepo: true,
    packagePath: 'packages/polyglot',
    buildCommands: ['pnpm install', 'pnpm run build']
  };

  try {
    console.log('📝 Creating bot via API...');
    const response = await fetch(`http://localhost:3420/api/v1/bots?userId=${ownerAddress}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(botRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as any;
      throw new Error(errorData.message || 'Failed to create bot');
    }

    const data = await response.json() as any;
    const newBot = data.bot;

    console.log('🎉 Bot created successfully!');
    console.log(`🤖 Bot ID: ${newBot.id}`);
    console.log(`👤 Bot Name: ${newBot.name}`);
    console.log(`🖼️  Bot Image: ${newBot.image}`);
    console.log(`📊 Bot Status: ${newBot.status}`);
    console.log(`🎨 Image Type: ${newBot.imageType}`);

    // If we want to update the image to use a specific Pokemon
    if (pokemonName && pokemonName !== botName) {
      console.log(`🎨 Updating image to use ${pokemonName}...`);

      // Generate image config for the specified Pokemon
      const imageConfig = createBotImageConfig(pokemonName!, newBot.id, 'pokemon');

      // Update the bot with the new image
      const updateResponse = await fetch(`http://localhost:3420/api/v1/bots?userId=${ownerAddress}&botId=${newBot.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newBot,
          image: imageConfig.image,
          imageType: imageConfig.imageType
        }),
      });

      if (updateResponse.ok) {
        const updatedData = await updateResponse.json() as any;
        console.log(`✅ Image updated to: ${updatedData.bot.image}`);
      } else {
        console.log('⚠️  Failed to update image, but bot was created successfully');
      }
    }

    return newBot;
  } catch (error) {
    console.error('❌ Failed to create bot:', (error as Error).message);
    throw error;
  }
}

// Run the script
createBot()
  .then(() => {
    console.log('🏁 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });