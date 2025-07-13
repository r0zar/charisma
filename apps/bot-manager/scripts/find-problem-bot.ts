#!/usr/bin/env tsx

// Load environment variables first
import './utils/env';
import { kv } from '@vercel/kv';

async function findProblemBot() {
  const botId = 'SP19HWS2A4QNTJDM18B66KTQ90MYW42JY4SAJAH5N';
  
  console.log('1. Checking exact bot key...');
  try {
    const bot = await kv.get(`bot-manager:bots:${botId}`);
    console.log('Bot found:', Boolean(bot));
    if (bot) {
      console.log('Bot data:', JSON.stringify(bot, null, 2));
    }
  } catch (error) {
    console.error('Error getting bot:', error);
  }
  
  console.log('\n2. Getting all bot keys...');
  const allBotKeys = await kv.keys('bot-manager:bots:*');
  console.log('Total bot keys:', allBotKeys.length);
  
  // Filter out index keys
  const actualBotKeys = allBotKeys.filter(key => !key.includes(':index') && !key.includes(':owned-bots'));
  console.log('Actual bot data keys:', actualBotKeys.length);
  
  console.log('\n3. Scanning for problem bot...');
  let foundCount = 0;
  let problemBots = [];
  
  for (const key of actualBotKeys) {
    try {
      const botData = await kv.get(key);
      if (botData) {
        // Check for problematic bots
        if (botData.id === botId || 
            botData.clerkUserId === 'NOT SET' || 
            (botData.clerkUserId && !botData.ownerId) ||
            botData.isScheduled !== undefined) {
          foundCount++;
          problemBots.push({ key, botData });
          console.log(`🚨 FOUND PROBLEM BOT #${foundCount}:`);
          console.log('Key:', key);
          console.log('ID:', botData.id);
          console.log('Name:', botData.name);
          console.log('ownerId:', botData.ownerId);
          console.log('clerkUserId:', botData.clerkUserId);
          console.log('isScheduled:', botData.isScheduled);
          console.log('---');
        }
      }
    } catch (error) {
      console.error(`Error getting data for key ${key}:`, error);
    }
  }
  
  console.log(`\nFound ${foundCount} problem bots total`);
  
  if (problemBots.length > 0) {
    console.log('\nAll problem bots:');
    problemBots.forEach((problem, index) => {
      console.log(`${index + 1}. ${problem.botData.name} (${problem.botData.id})`);
      console.log(`   Key: ${problem.key}`);
      console.log(`   ownerId: ${problem.botData.ownerId}`);
      console.log(`   clerkUserId: ${problem.botData.clerkUserId}`);
      console.log(`   isScheduled: ${problem.botData.isScheduled}`);
    });
  }
}

findProblemBot().catch(console.error);