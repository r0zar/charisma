#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { kv } from '@vercel/kv';

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            // Remove quotes if present
            const cleanValue = value.replace(/^["']|["']$/g, '');
            process.env[key.trim()] = cleanValue;
          }
        }
      }
      console.log(`ℹ️  Loaded environment variables from ${envPath}`);
    } else {
      console.warn(`⚠️  Environment file not found: ${envPath}`);
    }
  } catch (error) {
    console.error(`❌ Failed to load environment file: ${error}`);
  }
}

// Load environment variables before doing anything else
loadEnvFile();

async function cleanupKV() {
  console.log('🧹 Cleaning up all bot data from KV store...');
  
  try {
    // Get all keys that match the bot pattern
    const allKeys = await kv.keys('bot-manager:bots:*');
    console.log(`Found ${allKeys.length} bot-related keys`);
    
    if (allKeys.length === 0) {
      console.log('✅ No bot data found to clean up');
      return;
    }
    
    // Delete all bot keys
    for (const key of allKeys) {
      await kv.del(key);
      console.log(`  Deleted: ${key}`);
    }
    
    console.log(`✅ Cleaned up ${allKeys.length} keys from KV store`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupKV().catch(console.error);