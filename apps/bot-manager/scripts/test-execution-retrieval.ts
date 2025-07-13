#!/usr/bin/env node

/**
 * Test execution retrieval and blob logs functionality
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { executionDataStore, botDataStore } from '@/lib/modules/storage';

async function testExecutionRetrieval() {
  console.log('🔍 Testing execution retrieval...');
  
  const userId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
  
  // Get all bots
  const allBots = await botDataStore.getAllBotsPublic();
  console.log(`📊 Found ${allBots.length} bots`);
  
  if (allBots.length === 0) {
    console.log('❌ No bots found');
    return;
  }
  
  // Get executions for first few bots
  for (let i = 0; i < Math.min(3, allBots.length); i++) {
    const bot = allBots[i];
    console.log(`\n🤖 Checking executions for bot: ${bot.name} (${bot.id})`);
    
    const executions = await executionDataStore.getExecutions(userId, bot.id, 5);
    console.log(`📋 Found ${executions.length} executions`);
    
    for (const execution of executions) {
      console.log(`  ✅ ${execution.id}: ${execution.status} - ${execution.output || execution.error || 'No output'}`);
      if (execution.logsUrl) {
        console.log(`    📄 Logs: ${execution.logsUrl} (${execution.logsSize} bytes)`);
      }
    }
  }
}

testExecutionRetrieval().catch(console.error);