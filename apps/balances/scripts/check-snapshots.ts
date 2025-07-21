#!/usr/bin/env node
/**
 * Script to check what snapshots actually exist in blob storage
 */

// Load environment variables
import { config } from 'dotenv'
import { join } from 'path'

// Load .env.local from the app directory
config({ path: join(process.cwd(), '.env.local') })

import { SnapshotStorage, SnapshotReader, KVBalanceStore } from '@services/balances'

async function checkSnapshots() {
  console.log('🔍 Checking snapshot storage...')
  console.log('Environment variables:')
  console.log('- KV_URL:', process.env.KV_URL ? 'Set' : 'Missing')
  console.log('- BLOB_READ_WRITE_TOKEN:', process.env.BLOB_READ_WRITE_TOKEN ? 'Set' : 'Missing')
  
  if (!process.env.KV_URL || !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Missing required environment variables')
    process.exit(1)
  }

  try {
    // Initialize services
    console.log('\n📦 Initializing services...')
    const kvStore = new KVBalanceStore()
    const snapshotStorage = new SnapshotStorage()
    const snapshotReader = new SnapshotReader(snapshotStorage, kvStore)

    // Test storage connection
    console.log('\n🔌 Testing storage connection...')
    try {
      await snapshotStorage.testConnection()
      console.log('✅ Storage connection successful')
    } catch (error) {
      console.error('❌ Storage connection failed:', error)
      return
    }

    // Get snapshot index
    console.log('\n📋 Getting snapshot index...')
    const index = await snapshotReader.getSnapshotIndex()
    console.log('Index result:', index)

    if (!index || !index.timestamps || index.timestamps.length === 0) {
      console.log('❌ No snapshots found in index')
      return
    }

    console.log(`\n📊 Found ${index.timestamps.length} snapshots in index`)
    console.log(`📅 Date range: ${new Date(index.oldest)} to ${new Date(index.newest)}`)

    // Check a few recent snapshots
    console.log('\n🔍 Checking individual snapshots...')
    const recentTimestamps = index.timestamps.slice(-5) // Last 5 snapshots
    
    for (const timestamp of recentTimestamps) {
      console.log(`\n--- Checking snapshot ${timestamp} (${new Date(timestamp)}) ---`)
      
      // Check if snapshot exists in storage
      try {
        const exists = await snapshotStorage.snapshotExists(timestamp)
        console.log(`📁 Exists in storage: ${exists}`)
      } catch (error) {
        console.error(`❌ Error checking existence:`, error)
        continue
      }

      // Try to get snapshot metadata
      try {
        const metadata = await snapshotReader.getSnapshotMetadata(timestamp)
        console.log(`📋 Metadata:`, metadata)
      } catch (error) {
        console.error(`❌ Error getting metadata:`, error)
      }

      // Try to get snapshot data (just peek at structure)
      try {
        console.log(`📦 Attempting to load snapshot data...`)
        const snapshot = await snapshotReader.getSnapshot(timestamp)
        if (snapshot) {
          console.log(`✅ Snapshot loaded successfully`)
          console.log(`📊 Structure:`, {
            hasMetadata: !!snapshot.metadata,
            hasBalances: !!snapshot.balances,
            totalAddresses: snapshot.totalAddresses,
            totalContracts: snapshot.totalContracts,
            timestamp: snapshot.timestamp,
            metadataKeys: snapshot.metadata ? Object.keys(snapshot.metadata) : []
          })
        } else {
          console.log(`❌ Snapshot is null`)
        }
      } catch (error) {
        console.error(`❌ Error loading snapshot:`, error)
      }
    }

    // Check blob storage stats
    console.log('\n📊 Getting storage stats...')
    try {
      const stats = await snapshotStorage.getStorageStats()
      console.log('Storage stats:', stats)
    } catch (error) {
      console.error('❌ Error getting storage stats:', error)
    }

    // List recent blob operations
    console.log('\n🔄 Checking recent blob operations...')
    try {
      const recentOps = await snapshotStorage.getRecentBlobOperations(10)
      console.log(`Found ${recentOps?.length || 0} recent operations`)
      if (recentOps && recentOps.length > 0) {
        recentOps.forEach((op, i) => {
          console.log(`  ${i + 1}. ${op.type} - ${op.path} - ${op.size || 0} bytes - ${new Date(op.timestamp)}`)
        })
      }
    } catch (error) {
      console.error('❌ Error getting recent operations:', error)
    }

    console.log('\n✅ Snapshot check complete!')

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

// Run the check
checkSnapshots().catch(console.error)