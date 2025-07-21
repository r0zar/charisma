#!/usr/bin/env node
/**
 * Test Blob Storage operations
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { SnapshotStorage } from '@services/balances'

async function testBlobStorage() {
  console.log('🔍 Testing Blob Storage...')
  
  try {
    console.log('📦 Creating SnapshotStorage instance...')
    const storage = new SnapshotStorage()
    console.log('✅ SnapshotStorage created')

    // Test connection
    console.log('\n🔌 Testing connection...')
    await storage.testConnection()
    console.log('✅ Connection successful')

    // Test basic blob operations
    console.log('\n📝 Testing basic blob operations...')
    
    const testTimestamp = Date.now()
    const testData = {
      timestamp: testTimestamp,
      balances: { 'SP123...': { 'token1': { amount: '1000', lastUpdated: testTimestamp } } },
      totalAddresses: 1,
      totalContracts: 1,
      metadata: {
        createdAt: testTimestamp,
        originalSize: 100,
        compressedSize: 50,
        compressionRatio: 0.5,
        processingTime: 500,
        version: '1.0'
      }
    }

    console.log(`📤 Storing test snapshot: ${testTimestamp}`)
    try {
      await storage.storeSnapshot(testData)
      console.log('✅ Store successful')
    } catch (error) {
      console.error('❌ Store failed:', error.message)
      return
    }

    // Test existence check
    console.log(`🔍 Checking if snapshot exists: ${testTimestamp}`)
    const exists = await storage.snapshotExists(testTimestamp)
    console.log('✅ Exists check:', exists)

    // Test retrieval
    console.log(`📥 Retrieving snapshot: ${testTimestamp}`)
    try {
      const retrieved = await storage.getSnapshot(testTimestamp)
      console.log('✅ Retrieval successful')
      console.log('   Retrieved data keys:', retrieved ? Object.keys(retrieved) : 'null')
      console.log('   Has metadata:', !!retrieved?.metadata)
      if (retrieved?.metadata) {
        console.log('   Metadata keys:', Object.keys(retrieved.metadata))
      }
    } catch (error) {
      console.error('❌ Retrieval failed:', error.message)
    }

    // Test metadata retrieval
    console.log(`📋 Getting snapshot metadata: ${testTimestamp}`)
    try {
      const metadata = await storage.getSnapshotMetadata(testTimestamp)
      console.log('✅ Metadata retrieval result:', metadata)
    } catch (error) {
      console.error('❌ Metadata retrieval failed:', error.message)
    }

    // Test storage stats
    console.log('\n📊 Testing storage stats...')
    try {
      const stats = await storage.getStorageStats()
      console.log('✅ Storage stats:', stats)
    } catch (error) {
      console.warn('⚠️  Storage stats failed:', error.message)
    }

    // Clean up
    console.log(`\n🗑️  Cleaning up test snapshot: ${testTimestamp}`)
    try {
      await storage.deleteSnapshot(testTimestamp)
      console.log('✅ Cleanup successful')
    } catch (error) {
      console.warn('⚠️  Cleanup failed:', error.message)
    }

    console.log('\n✅ Blob Storage test completed!')

  } catch (error) {
    console.error('❌ Blob Storage test failed:', error)
    process.exit(1)
  }
}

testBlobStorage().catch(console.error)