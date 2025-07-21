#!/usr/bin/env node
/**
 * Test Snapshot Creation
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { BalanceSnapshotScheduler, SnapshotStorage, KVBalanceStore } from '@services/balances'

async function testSnapshotCreation() {
  console.log('🔍 Testing Snapshot Creation...')
  
  try {
    console.log('📦 Creating services...')
    const kvStore = new KVBalanceStore()
    const storage = new SnapshotStorage()
    const scheduler = new BalanceSnapshotScheduler(kvStore, storage)
    console.log('✅ Services created')

    // Test scheduler status
    console.log('\n📊 Checking scheduler status...')
    const status = await scheduler.getStatus()
    console.log('✅ Scheduler status:', status)

    // Add some test balance data first
    console.log('\n💰 Adding test balance data...')
    const testAddress = 'SP1234TEST'
    const testContract = 'SP5678.test-token'
    const testBalance = {
      amount: '1000000',
      lastUpdated: Date.now()
    }

    try {
      // Store balance in KV
      const balanceKey = `balance:${testAddress}:${testContract}`
      await kvStore.set(balanceKey, JSON.stringify(testBalance))
      console.log('✅ Test balance added')
    } catch (error) {
      console.warn('⚠️  Failed to add test balance:', error.message)
    }

    // Test snapshot creation
    console.log('\n📸 Creating snapshot...')
    try {
      const result = await scheduler.createSnapshot()
      console.log('✅ Snapshot created successfully!')
      console.log('   Result:', {
        timestamp: result.timestamp,
        success: result.success,
        duration: result.duration,
        key: result.key,
        compressionRatio: result.compressionRatio
      })

      // Test if we can retrieve it immediately
      console.log('\n🔍 Testing immediate retrieval...')
      const exists = await storage.snapshotExists(result.timestamp)
      console.log('   Exists in storage:', exists)

      if (exists) {
        try {
          const snapshot = await storage.getSnapshot(result.timestamp)
          console.log('   Retrieved successfully:', !!snapshot)
          if (snapshot) {
            console.log('   Snapshot structure:', {
              hasBalances: !!snapshot.balances,
              totalAddresses: snapshot.totalAddresses,
              totalContracts: snapshot.totalContracts,
              hasMetadata: !!snapshot.metadata,
              timestamp: snapshot.timestamp
            })
          }
        } catch (error) {
          console.error('❌ Failed to retrieve created snapshot:', error.message)
        }
      }

    } catch (error) {
      console.error('❌ Snapshot creation failed:', error)
    }

    // Check updated index
    console.log('\n📋 Checking snapshot index after creation...')
    const index = await scheduler.getSnapshotIndex()
    console.log('✅ Index updated:', {
      count: index.count,
      newest: new Date(index.newest),
      timestamps: index.timestamps.slice(-3) // Last 3
    })

    console.log('\n✅ Snapshot creation test completed!')

  } catch (error) {
    console.error('❌ Snapshot creation test failed:', error)
    process.exit(1)
  }
}

testSnapshotCreation().catch(console.error)