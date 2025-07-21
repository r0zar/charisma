#!/usr/bin/env node
/**
 * Reset the snapshot system by cleaning up all corrupted snapshots
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { BalanceSnapshotScheduler, SnapshotStorage, KVBalanceStore } from '@services/balances'

async function resetSnapshots() {
  console.log('🔄 Resetting snapshot system...')
  
  try {
    console.log('📦 Creating services...')
    const kvStore = new KVBalanceStore()
    const storage = new SnapshotStorage()
    const scheduler = new BalanceSnapshotScheduler(kvStore, storage)
    console.log('✅ Services created')

    // Get current index
    const index = await scheduler.getSnapshotIndex()
    
    if (!index) {
      console.log('❌ Failed to get snapshot index')
      return
    }
    
    console.log(`\n📋 Current index has ${index.count} snapshots`)

    if (index.timestamps.length === 0) {
      console.log('✅ Already clean!')
      return
    }

    // Delete all corrupted blob files
    console.log('\n🗑️  Deleting corrupted blob files...')
    let deletedCount = 0
    for (const timestamp of index.timestamps) {
      try {
        await storage.deleteSnapshot(timestamp)
        deletedCount++
        console.log(`  ✅ Deleted ${timestamp}`)
      } catch (error) {
        console.log(`  ⚠️  Failed to delete ${timestamp}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    console.log(`✅ Deleted ${deletedCount} blob files`)

    // Now we need to reset the index manually
    console.log('\n📋 Resetting the snapshot index...')
    
    // The index is stored in KV, we need to clear it
    // Let's check what the scheduler uses for index storage
    try {
      // Create a fresh index
      const emptyIndex = {
        timestamps: [],
        count: 0,
        oldest: Date.now(),
        newest: Date.now(),
        lastUpdated: Date.now()
      }

      // Try to find and clear the index key
      // This might be stored as 'snapshot-index' or similar
      console.log('🔍 Looking for index storage key...')
      
      // We'll need to be more creative here - let's check the storage stats first
      const stats = await storage.getStorageStats()
      console.log('📊 Storage stats after cleanup:', stats)

      console.log('\n💡 Manual index reset needed.')
      console.log('The index is stored in KV storage and needs to be manually cleared.')
      console.log('This might require direct KV operations or recreating the scheduler.')

      // For now, let's try creating a new snapshot to see if it resets properly
      console.log('\n🧪 Testing system with a new snapshot...')
      try {
        // Add some test balance data first
        const testBalance = {
          amount: '1000',
          lastUpdated: Date.now()
        }
        
        // Use the proper KV method
        await kvStore.setBalance('SP1234TEST', 'SP5678.test-token', testBalance)
        console.log('✅ Added test balance data')

        // Create a new snapshot
        const result = await scheduler.createSnapshot()
        console.log('✅ New snapshot created:', {
          timestamp: result.timestamp,
          success: result.success,
          key: result.key
        })

        // Check the updated index
        const newIndex = await scheduler.getSnapshotIndex()
        console.log('📋 Updated index:', {
          count: newIndex.count,
          timestamps: newIndex.timestamps
        })

      } catch (error) {
        console.error('❌ Test snapshot failed:', error instanceof Error ? error.message : String(error))
      }

    } catch (error) {
      console.error('❌ Index reset failed:', error instanceof Error ? error.message : String(error))
    }

    console.log('\n✅ Snapshot system reset attempted!')
    console.log('💡 You may need to restart the application to fully reset the index.')

  } catch (error) {
    console.error('❌ Reset script failed:', error)
    process.exit(1)
  }
}

resetSnapshots().catch(console.error)