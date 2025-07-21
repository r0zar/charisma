#!/usr/bin/env node
/**
 * Clear the corrupted KV snapshot index completely
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { kv } from '@vercel/kv'
import { KVBalanceStore } from '@services/balances'

async function clearIndex() {
  console.log('🧹 Clearing corrupted snapshot index...')
  
  try {
    console.log('📦 Accessing KV store...')

    // The snapshot index keys based on the codebase analysis
    const indexKeys = [
      'balance:snapshots:index',  // Primary key used by SnapshotStorage
      'snapshot-index'            // Legacy key
    ]

    console.log('\n🔍 Clearing snapshot index keys...')
    
    for (const key of indexKeys) {
      try {
        // Check if key exists
        const existingIndex = await kv.get(key)
        
        if (existingIndex) {
          console.log(`📋 Found corrupted index at '${key}':`)
          const indexData = existingIndex as any
          console.log(`   Timestamps: ${indexData.timestamps?.length || 0}`)
          console.log(`   Count: ${indexData.count || 0}`)
          
          // Delete the corrupted index
          await kv.del(key)
          console.log(`✅ Deleted corrupted index at '${key}'`)
          
          // Verify deletion
          const deleted = await kv.get(key)
          if (deleted === null) {
            console.log(`✅ Verified index '${key}' was deleted`)
          } else {
            console.log(`⚠️  Index '${key}' still exists after deletion`)
          }
        } else {
          console.log(`❌ No index found at '${key}'`)
        }
      } catch (error) {
        console.log(`⚠️  Error processing key '${key}':`, error instanceof Error ? error.message : String(error))
      }
    }

    console.log('\n🧪 Testing with fresh services...')
    
    // Import and create fresh services
    const { BalanceSnapshotScheduler, SnapshotStorage } = await import('@services/balances')
    
    const kvStore = new KVBalanceStore()
    const storage = new SnapshotStorage()
    const scheduler = new BalanceSnapshotScheduler(kvStore, storage)
    
    // Add test data
    await kvStore.setBalance('SP1234TEST', 'SP5678.test-token', '2000')
    console.log('✅ Added fresh test balance data')

    // Create a new snapshot to rebuild the index
    const result = await scheduler.createSnapshot()
    console.log('✅ Fresh snapshot created:', {
      timestamp: result.timestamp,
      success: result.success
    })

    // Check the rebuilt index
    const newIndex = await scheduler.getSnapshotIndex()
    console.log('📋 Rebuilt index:', {
      count: newIndex?.count || 0,
      timestamps: newIndex?.timestamps || []
    })

    console.log('\n✅ Index cleanup and rebuild completed!')
    console.log('🔄 The snapshot system should now be working with a clean index.')

  } catch (error) {
    console.error('❌ Clear index script failed:', error)
    process.exit(1)
  }
}

clearIndex().catch(console.error)