#!/usr/bin/env node
/**
 * Test KV Store operations
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { KVBalanceStore } from '@services/balances'

async function testKVStore() {
  console.log('🔍 Testing KV Store...')
  
  try {
    console.log('📦 Creating KVBalanceStore instance...')
    const kvStore = new KVBalanceStore()
    console.log('✅ KVBalanceStore created')

    // Test basic operations
    console.log('\n📝 Testing basic KV operations...')
    
    // Test set/get
    const testKey = `test-${Date.now()}`
    const testValue = { test: 'data', timestamp: Date.now() }
    
    console.log(`📤 Setting key: ${testKey}`)
    await kvStore.set(testKey, JSON.stringify(testValue))
    console.log('✅ Set successful')
    
    console.log(`📥 Getting key: ${testKey}`)
    const retrieved = await kvStore.get(testKey)
    console.log('✅ Get successful:', retrieved)
    
    // Test delete
    console.log(`🗑️  Deleting key: ${testKey}`)
    await kvStore.delete(testKey)
    console.log('✅ Delete successful')

    // Test getting stats
    console.log('\n📊 Testing stats...')
    try {
      const stats = await kvStore.getStats()
      console.log('✅ Stats retrieved:', stats)
    } catch (error) {
      console.warn('⚠️  Stats failed:', error.message)
    }

    // Test getting all addresses
    console.log('\n👥 Testing getAllAddresses...')
    try {
      const addresses = await kvStore.getAllAddresses()
      console.log('✅ Addresses retrieved:', addresses.length, 'addresses')
      if (addresses.length > 0) {
        console.log('   First few addresses:', addresses.slice(0, 3))
      }
    } catch (error) {
      console.warn('⚠️  getAllAddresses failed:', error.message)
    }

    console.log('\n✅ KV Store test completed successfully!')

  } catch (error) {
    console.error('❌ KV Store test failed:', error)
    process.exit(1)
  }
}

testKVStore().catch(console.error)