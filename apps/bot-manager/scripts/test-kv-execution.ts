#!/usr/bin/env node

/**
 * Simple test script to isolate KV execution storage issues
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

console.log('🔧 Environment check:');
console.log('KV_REST_API_URL:', process.env.KV_REST_API_URL ? 'SET' : 'NOT SET');
console.log('KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? 'SET' : 'NOT SET');
console.log('BLOB_READ_WRITE_TOKEN:', process.env.BLOB_READ_WRITE_TOKEN ? 'SET' : 'NOT SET');

import { executionDataStore } from '@/lib/modules/storage';
import { BotExecution } from '@/schemas/bot.schema';

async function testKVStorage() {
  console.log('🧪 Testing KV execution storage...');
  
  const userId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
  
  // Create a simple test execution
  const testExecution: BotExecution = {
    id: 'test-execution-' + Date.now(),
    botId: 'SP1WK2ST69TKQP8M720YPEEYNNWYJ06ETEGRVH3KJ',
    startedAt: new Date().toISOString(),
    completedAt: new Date(Date.now() + 5000).toISOString(),
    status: 'success',
    output: 'Test execution completed successfully',
    executionTime: 5000,
    sandboxId: 'sbx_test123'
  };

  console.log('📋 Test execution data:');
  console.log(JSON.stringify(testExecution, null, 2));
  
  try {
    console.log('💾 Attempting to store execution...');
    const success = await executionDataStore.storeExecution(userId, testExecution);
    
    if (success) {
      console.log('✅ Storage successful!');
      
      // Try to retrieve it
      console.log('📖 Attempting to retrieve execution...');
      const executions = await executionDataStore.getExecutions(userId, testExecution.botId, 10);
      console.log(`📊 Retrieved ${executions.length} executions`);
      
      const found = executions.find(e => e.id === testExecution.id);
      if (found) {
        console.log('✅ Retrieval successful!');
        console.log('📋 Retrieved execution:', JSON.stringify(found, null, 2));
      } else {
        console.log('❌ Execution not found in results');
      }
    } else {
      console.log('❌ Storage failed (returned false)');
    }
  } catch (error) {
    console.error('❌ Storage threw exception:', error);
  }
}

testKVStorage().catch(console.error);