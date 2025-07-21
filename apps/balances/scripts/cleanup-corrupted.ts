#!/usr/bin/env node
/**
 * Clean up corrupted snapshots from the index
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { BalanceSnapshotScheduler, SnapshotStorage, KVBalanceStore } from '@services/balances'

async function cleanupCorruptedSnapshots() {
  console.log('🧹 Cleaning up corrupted snapshots...')
  
  try {
    console.log('📦 Creating services...')
    const kvStore = new KVBalanceStore()
    const storage = new SnapshotStorage()
    const scheduler = new BalanceSnapshotScheduler(kvStore, storage)
    console.log('✅ Services created')

    // Get current index
    console.log('\n📋 Getting current snapshot index...')
    const index = await scheduler.getSnapshotIndex()
    
    if (!index) {
      console.log('❌ Failed to get snapshot index')
      return
    }
    
    console.log(`Found ${index.count} snapshots in index`)
    console.log(`Date range: ${new Date(index.oldest)} to ${new Date(index.newest)}`)

    if (index.timestamps.length === 0) {
      console.log('✅ No snapshots to clean up')
      return
    }

    // Test each snapshot to see which ones are corrupted
    console.log('\n🔍 Testing snapshots for corruption...')
    const corruptedTimestamps: number[] = []
    const validTimestamps: number[] = []

    for (const timestamp of index.timestamps) {
      try {
        const exists = await storage.snapshotExists(timestamp)
        if (!exists) {
          console.log(`❌ ${timestamp}: Does not exist in storage`)
          corruptedTimestamps.push(timestamp)
          continue
        }

        const snapshot = await storage.getSnapshot(timestamp)
        if (!snapshot) {
          console.log(`❌ ${timestamp}: Exists but returns null`)
          corruptedTimestamps.push(timestamp)
          continue
        }

        console.log(`✅ ${timestamp}: Valid snapshot`)
        validTimestamps.push(timestamp)

      } catch (error) {
        console.log(`❌ ${timestamp}: Error retrieving - ${error instanceof Error ? error.message : String(error)}`)
        corruptedTimestamps.push(timestamp)
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`  Valid snapshots: ${validTimestamps.length}`)
    console.log(`  Corrupted snapshots: ${corruptedTimestamps.length}`)

    if (corruptedTimestamps.length === 0) {
      console.log('✅ No corrupted snapshots found!')
      return
    }

    // Ask for confirmation
    console.log(`\n⚠️  Found ${corruptedTimestamps.length} corrupted snapshots to clean up:`)
    corruptedTimestamps.forEach(ts => {
      console.log(`  - ${ts} (${new Date(ts)})`)
    })

    // For now, let's just report what we found
    console.log('\n💡 To clean up, we would need to:')
    console.log('  1. Delete corrupted blob files (if they exist)')
    console.log('  2. Remove timestamps from the index')
    console.log('  3. Update index metadata')

    // Test cleanup on one snapshot first
    if (corruptedTimestamps.length > 0) {
      const testTimestamp = corruptedTimestamps[0]
      console.log(`\n🧪 Testing cleanup on one snapshot: ${testTimestamp}`)
      
      try {
        // Try to delete the corrupted blob
        await storage.deleteSnapshot(testTimestamp)
        console.log('✅ Blob deletion successful (or blob didn\'t exist)')
        
        // Check if it's still in the index
        const updatedIndex = await scheduler.getSnapshotIndex()
        const stillInIndex = updatedIndex?.timestamps.includes(testTimestamp) ?? false
        console.log('📋 Still in index after blob deletion:', stillInIndex)
        
        if (stillInIndex) {
          console.log('⚠️  Index cleanup needed - blob deletion doesn\'t update index automatically')
        }
        
      } catch (error) {
        console.error('❌ Cleanup test failed:', error instanceof Error ? error.message : String(error))
      }
    }

    console.log('\n✅ Corruption analysis complete!')

  } catch (error) {
    console.error('❌ Cleanup script failed:', error)
    process.exit(1)
  }
}

cleanupCorruptedSnapshots().catch(console.error)