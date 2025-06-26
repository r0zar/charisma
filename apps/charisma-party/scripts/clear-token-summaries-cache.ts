#!/usr/bin/env tsx

/**
 * Clear Token Summaries Cache
 * 
 * This script clears the Redis cache for token-summaries to force fresh data fetch
 */

import { kv } from '@vercel/kv';

const CACHE_KEY = 'token-summaries';

async function clearTokenSummariesCache() {
  console.log('🧹 CLEARING TOKEN SUMMARIES CACHE');
  console.log('=================================\n');

  try {
    // Check if cache exists
    const cached = await kv.get(CACHE_KEY);
    
    if (cached) {
      console.log('🔍 Found cached token-summaries data');
      console.log(`📊 Cache contains ${Array.isArray(cached) ? cached.length : 'unknown'} items`);
      
      // Clear the cache
      const deleted = await kv.del(CACHE_KEY);
      console.log(`🗑️  Cache cleared: ${deleted} key(s) deleted`);
      
    } else {
      console.log('ℹ️  No cached token-summaries data found');
    }
    
    console.log('\n✅ Cache clearing completed!');
    console.log('💡 Next API request will fetch fresh data from metadata sources');
    
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
    process.exit(1);
  }
}

// Show usage information
function showUsage() {
  console.log('Usage: pnpm script clear-token-summaries-cache');
  console.log('\nDescription:');
  console.log('  Clears the Redis cache for token-summaries API to force fresh data fetch.');
  console.log('  Use this when token metadata has been updated but is not reflected in');
  console.log('  the token-summaries API due to caching.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

clearTokenSummariesCache().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});