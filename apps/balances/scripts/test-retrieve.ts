#!/usr/bin/env node
/**
 * Test Snapshot Retrieval
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { SnapshotReader, SnapshotStorage, KVBalanceStore } from '@services/balances'

async function testSnapshotRetrieval() {
  console.log('🔍 Testing Snapshot Retrieval...')
  
  try {
    console.log('📦 Creating services...')
    const kvStore = new KVBalanceStore()
    const storage = new SnapshotStorage()
    const reader = new SnapshotReader(storage, kvStore)
    console.log('✅ Services created')

    // Get the snapshot index
    console.log('\n📋 Getting snapshot index...')
    const index = await reader.getSnapshotIndex()
    
    if (!index) {
      console.log('❌ Failed to get snapshot index')
      return
    }
    
    console.log('✅ Index retrieved:', {
      count: index.count,
      oldest: new Date(index.oldest),
      newest: new Date(index.newest)
    })

    if (index.timestamps.length === 0) {
      console.log('❌ No snapshots in index to test retrieval')
      return
    }

    // Test retrieving a few snapshots
    const testTimestamps = index?.timestamps.slice(-3) || [] // Last 3 snapshots
    console.log(`\n🔍 Testing retrieval of ${testTimestamps.length} snapshots...`)

    for (const timestamp of testTimestamps) {
      console.log(`\n--- Testing snapshot ${timestamp} (${new Date(timestamp)}) ---`)

      // Test existence
      console.log('  📁 Checking existence...')
      const exists = await storage.snapshotExists(timestamp)
      console.log('     Exists:', exists)

      if (!exists) {
        console.log('  ❌ Snapshot does not exist, skipping')
        continue
      }

      // Test metadata retrieval (SnapshotReader method)
      console.log('  📋 Testing SnapshotReader.getSnapshotMetadata()...')
      try {
        const metadata = await reader.getSnapshotMetadata(timestamp)
        console.log('     Result:', metadata)
      } catch (error) {
        console.error('     Error:', error instanceof Error ? error.message : String(error))
      }

      // Test direct storage metadata retrieval
      console.log('  📋 Testing SnapshotStorage.getSnapshotMetadata()...')
      try {
        const metadata = await storage.getSnapshotMetadata(timestamp)
        console.log('     Result:', metadata)
      } catch (error) {
        console.error('     Error:', error instanceof Error ? error.message : String(error))
      }

      // Test full snapshot retrieval (SnapshotReader method)
      console.log('  📦 Testing SnapshotReader.getSnapshot()...')
      try {
        const snapshot = await reader.getSnapshot(timestamp)
        if (snapshot) {
          console.log('     ✅ Retrieved successfully')
          console.log('     Structure:', {
            hasBalances: !!snapshot.balances,
            totalAddresses: snapshot.totalAddresses,
            totalContracts: snapshot.totalContracts,
            hasMetadata: !!snapshot.metadata,
            timestamp: snapshot.timestamp,
            metadataKeys: snapshot.metadata ? Object.keys(snapshot.metadata) : []
          })
        } else {
          console.log('     ❌ Retrieved null')
        }
      } catch (error) {
        console.error('     Error:', error instanceof Error ? error.message : String(error))
      }

      // Test direct storage retrieval
      console.log('  📦 Testing SnapshotStorage.getSnapshot()...')
      try {
        const snapshot = await storage.getSnapshot(timestamp)
        if (snapshot) {
          console.log('     ✅ Retrieved successfully')
          console.log('     Structure:', {
            hasBalances: !!snapshot.balances,
            totalAddresses: snapshot.totalAddresses,
            totalContracts: snapshot.totalContracts,
            hasMetadata: !!snapshot.metadata,
            timestamp: snapshot.timestamp
          })
        } else {
          console.log('     ❌ Retrieved null')
        }
      } catch (error) {
        console.error('     Error:', error instanceof Error ? error.message : String(error))
      }
    }

    // Test specific SnapshotReader methods
    console.log('\n🔍 Testing SnapshotReader specific methods...')
    
    try {
      console.log('  📊 Testing getAvailableTimestamps()...')
      const timestamps = await reader.getAvailableTimestamps()
      console.log('     Available timestamps:', timestamps?.length || 0)
    } catch (error) {
      console.error('     Error:', error.message)
    }

    try {
      console.log('  📈 Testing getLatestSnapshot()...')
      const latest = await reader.getLatestSnapshot()
      console.log('     Latest snapshot:', latest ? 'Retrieved' : 'null')
    } catch (error) {
      console.error('     Error:', error.message)
    }

    console.log('\n✅ Snapshot retrieval test completed!')

  } catch (error) {
    console.error('❌ Snapshot retrieval test failed:', error)
    process.exit(1)
  }
}

testSnapshotRetrieval().catch(console.error)