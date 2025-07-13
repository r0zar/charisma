#!/usr/bin/env tsx

/**
 * Simple Demo Bot Creation Script
 * 
 * Creates demo bots with predefined strategies
 */

import { config } from 'dotenv';
import { botDataStore } from '../src/lib/modules/storage/index.js';

// Load environment variables
config({ path: '.env.local' });

// Demo bot configurations
const demoBots = [
  {
    name: 'DeFi Sentinel',
    strategy: `// DeFi Yield Monitor Strategy
console.log('🚨 Monitoring DeFi yields and liquidity pools');
console.log('Current wallet:', bot.id);
console.log('Checking for arbitrage opportunities...');

// Simulated yield monitoring logic
if (Math.random() > 0.7) {
  console.log('💰 High yield opportunity detected!');
} else {
  console.log('📊 Markets stable, continuing monitoring...');
}`,
    status: 'active'
  },
  {
    name: 'Yield Hunter',
    strategy: `// Automated Yield Farming Strategy
console.log('🌾 Scanning for optimal yield farming opportunities');
console.log('Bot wallet address:', bot.id);

// Mock yield farming logic
const pools = ['STX-USDA', 'ALEX-STX', 'BANANA-STX'];
const randomPool = pools[Math.floor(Math.random() * pools.length)];
console.log('🎯 Targeting pool:', randomPool);
console.log('💎 Estimated APY: ' + (Math.random() * 50 + 10).toFixed(2) + '%');`,
    status: 'active'
  },
  {
    name: 'Arbitrage Pro',
    strategy: `// Cross-DEX Arbitrage Strategy
console.log('⚡ Scanning for arbitrage opportunities across DEXs');
console.log('Bot ID:', bot.id);

// Simulated arbitrage detection
const dexes = ['Alex', 'Arkadiko', 'StackSwap'];
console.log('🔍 Comparing prices across:', dexes.join(', '));

if (Math.random() > 0.8) {
  console.log('🚀 Profitable arbitrage found! Executing trade...');
} else {
  console.log('⏳ No arbitrage opportunities at the moment');
}`,
    status: 'paused'
  },
  {
    name: 'Risk Guardian',
    strategy: `// Portfolio Risk Management
console.log('🛡️ Monitoring portfolio risk and exposure');
console.log('Guardian wallet:', bot.id);

// Mock risk assessment
const riskLevel = Math.random();
if (riskLevel > 0.7) {
  console.log('⚠️ High risk detected! Reducing exposure...');
} else if (riskLevel > 0.4) {
  console.log('⚡ Moderate risk - maintaining positions');
} else {
  console.log('✅ Low risk environment - opportunity to increase exposure');
}`,
    status: 'active'
  },
  {
    name: 'Trend Tracker',
    strategy: `// Market Trend Analysis Bot
console.log('📈 Analyzing market trends and momentum');
console.log('Tracker address:', bot.id);

// Simulated trend analysis
const trendTypes = ['Bullish', 'Bearish', 'Sideways', 'Volatile'];
const currentTrend = trendTypes[Math.floor(Math.random() * trendTypes.length)];
console.log('📊 Current market trend:', currentTrend);

if (currentTrend === 'Bullish') {
  console.log('🚀 Bull market detected - increasing long positions');
} else if (currentTrend === 'Bearish') {
  console.log('🐻 Bear market - defensive positioning activated');
}`,
    status: 'setup'
  }
];

// Community bot names and strategies for diversity
const communityBots = [
  {
    name: 'Moonshot',
    strategy: `console.log('🚀 Looking for the next 100x gem!');
console.log('Wallet:', bot.id);`,
    status: 'active',
    ownerId: 'SP1ABCDEFG1234567890HIJKLMNOPQRSTUVWXYZ'
  },
  {
    name: 'Diamond Hands',
    strategy: `console.log('💎 HODL strategy activated');
console.log('Never selling:', bot.id);`,
    status: 'active',
    ownerId: 'SP2XYZABC9876543210DEFGHIJKLMNOPQRSTUVW'
  },
  {
    name: 'Quick Trader',
    strategy: `console.log('⚡ Fast trading bot');
console.log('Speed is key:', bot.id);`,
    status: 'paused',
    ownerId: 'SP3QWERTY1357924680ASDFGHJKLZXCVBNMQWE'
  },
  {
    name: 'Stable Coin Pro',
    strategy: `console.log('🪙 Stablecoin arbitrage master');
console.log('Bot address:', bot.id);`,
    status: 'active',
    ownerId: 'SP4UIOPAS5792468135FGHJKLQWERTYUIOPASDF'
  },
  {
    name: 'NFT Flipper',
    strategy: `console.log('🖼️ NFT trading algorithm');
console.log('Finding rare gems at:', bot.id);`,
    status: 'setup',
    ownerId: 'SP5ZXCVBN2468135790MNBVCXZASDFGHJKLQWER'
  },
  {
    name: 'Degen Ape',
    strategy: `console.log('🦍 Going full degen mode!');
console.log('YOLO wallet:', bot.id);`,
    status: 'error',
    ownerId: 'SP6HJKLZX8642097531QWERTYUIOPASDFGHJKLM'
  },
  {
    name: 'Whale Watcher',
    strategy: `console.log('🐋 Following whale movements');
console.log('Tracking from:', bot.id);`,
    status: 'active',
    ownerId: 'SP7MNBVCX7531598462ASDFGHJKLQWERTYUIOPA'
  },
  {
    name: 'Smart Beta',
    strategy: `console.log('🧠 Algorithmic trading with smart beta');
console.log('Beta address:', bot.id);`,
    status: 'paused',
    ownerId: 'SP8ASDFGH9753185642QWERTYUIOPMNBVCXZLKJ'
  }
];

function generateStacksAddress(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'SP';
  for (let i = 0; i < 39; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function createDemoBots() {
  console.log('🤖 CREATING DEMO BOTS FOR LAUNCH...');
  
  const yourClerkUserId = 'user_2znyieHPBs2QVYWqDalHnjOYIwD';
  const yourWalletAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
  
  try {
    // Create your bots
    console.log(`👤 Creating ${demoBots.length} bots for your account...`);
    
    for (const [index, botTemplate] of demoBots.entries()) {
      const botId = generateStacksAddress();
      const bot = {
        id: botId,
        name: botTemplate.name,
        strategy: botTemplate.strategy,
        status: botTemplate.status as any,
        ownerId: yourWalletAddress,
        clerkUserId: yourClerkUserId,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // Random time in last 7 days
        lastActive: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(), // Random time in last 24 hours
        updatedAt: new Date().toISOString(),
        
        // Default values
        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${Math.floor(Math.random() * 150) + 1}.png`,
        imageType: 'pokemon' as const,
        isScheduled: false,
        executionCount: Math.floor(Math.random() * 100)
      };
      
      // Save to both storage systems
      await botDataStore.updateBot(yourWalletAddress, bot);
      await botDataStore.createBotByClerkUserId(yourClerkUserId, bot);
      
      console.log(`    ✅ Created: ${bot.name} (${bot.status}) - ${bot.id}`);
    }
    
    // Create community bots
    console.log(`\n🌍 Creating ${communityBots.length} community bots...`);
    
    for (const [index, botTemplate] of communityBots.entries()) {
      const botId = generateStacksAddress();
      const bot = {
        id: botId,
        name: botTemplate.name,
        strategy: botTemplate.strategy,
        status: botTemplate.status as any,
        ownerId: botTemplate.ownerId,
        clerkUserId: 'NOT SET', // Simulate non-migrated users
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Random time in last 30 days
        lastActive: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(), // Random time in last 3 days
        updatedAt: new Date().toISOString(),
        
        // Default values
        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${Math.floor(Math.random() * 150) + 1}.png`,
        imageType: 'pokemon' as const,
        isScheduled: false,
        executionCount: Math.floor(Math.random() * 50)
      };
      
      // Save to wallet-based storage only
      await botDataStore.updateBot(botTemplate.ownerId, bot);
      
      console.log(`    ✅ Created: ${bot.name} (${bot.status}) - Owner: ${bot.ownerId.substring(0, 20)}...`);
    }
    
    const totalBots = demoBots.length + communityBots.length;
    console.log(`\n🎉 Successfully created ${totalBots} demo bots!`);
    console.log(`👤 Your bots: ${demoBots.length}`);
    console.log(`🌍 Community bots: ${communityBots.length}`);
    
    // Show status breakdown
    const allStatuses = [...demoBots.map(b => b.status), ...communityBots.map(b => b.status)];
    const statusCounts = allStatuses.reduce((acc, status) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📊 Status breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`    ${status}: ${count} bots`);
    });
    
    console.log('\n🚀 Demo environment ready for launch!');
    console.log('💡 Remember to refresh the /bots page to see the new bots');
    
  } catch (error) {
    console.error('❌ Error creating demo bots:', error);
    process.exit(1);
  }
}

createDemoBots();