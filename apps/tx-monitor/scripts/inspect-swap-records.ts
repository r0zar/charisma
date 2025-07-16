/**
 * Inspect the actual swap records to understand the data structure
 */

import './logger'; // Import logger which also imports dotenv
import { kv } from '@vercel/kv';

async function inspectSwapRecords() {
  console.log('🔍 Inspecting Swap Records\n');

  try {
    // Get some recent swap record keys
    console.log('📋 Fetching swap record keys...');
    
    // Get all keys that match swap-records pattern
    const keys = await kv.hkeys('swap-records');
    console.log(`Found ${keys.length} swap record keys`);

    // Inspect the first few records
    for (let i = 0; i < Math.min(3, keys.length); i++) {
      const key = keys[i];
      console.log(`\n🔹 Swap Record Key: ${key}`);
      
      const swapData = await kv.hget('swap-records', key);
      if (swapData) {
        const swap = typeof swapData === 'string' ? JSON.parse(swapData) : swapData;
        
        console.log('📊 Swap Data Structure:');
        console.log(`   - inputToken: ${swap.inputToken}`);
        console.log(`   - inputAmount: ${swap.inputAmount}`);
        console.log(`   - outputToken: ${swap.outputToken}`);
        console.log(`   - outputAmount: ${swap.outputAmount}`);
        console.log(`   - status: ${swap.status}`);
        console.log(`   - timestamp: ${swap.timestamp}`);
        console.log(`   - owner: ${swap.owner}`);
        
        // Check if there are other amount-related fields
        console.log('\n📝 All fields in swap record:');
        Object.keys(swap).forEach(key => {
          if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('output')) {
            console.log(`   - ${key}: ${JSON.stringify(swap[key])}`);
          }
        });
        
        console.log('\n🔍 Full record (truncated):');
        console.log(JSON.stringify(swap, null, 2).slice(0, 500) + '...');
      }
      
      console.log('\n' + '─'.repeat(80));
    }

  } catch (error) {
    console.error('❌ Error during inspection:', error);
  }
}

// Run the inspect script
inspectSwapRecords().then(() => {
  console.log('\n✅ Inspection completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});