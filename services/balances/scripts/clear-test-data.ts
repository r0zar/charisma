#!/usr/bin/env tsx
/**
 * Clear only the test snapshot data we created during E2E testing
 */

import './utils'
import { kv } from '@vercel/kv';

async function clearTestData() {
  console.log('🧹 Clearing test snapshot data...');

  try {
    // Get the current snapshot index
    const index = await kv.get<any>('snapshot-index');

    if (index && index.timestamps) {
      console.log(`📋 Found ${index.timestamps.length} snapshots in index`);
      console.log('🔍 Timestamps:', index.timestamps.map((ts: number) => new Date(ts).toISOString()));

      // Only clear the snapshot index (the actual blob files are already cleaned up by tests)
      await kv.del('snapshot-index');
      console.log('✅ Cleared snapshot index');
    } else {
      console.log('📋 No snapshot index found');
    }

    console.log('🎉 Test data cleanup complete!');
  } catch (error) {
    console.error('❌ Failed to clear test data:', error);
  }
}

clearTestData().catch(console.error);