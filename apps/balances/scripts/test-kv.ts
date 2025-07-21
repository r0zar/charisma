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
    
    // Test setBalance/getBalance (using KVBalanceStore specific methods)
    const testAddress = `SP1TEST${Date.now()}`
    const testContract = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
    const testBalance = '1000000'
    
    console.log(`📤 Setting balance: ${testBalance} for ${testContract} of ${testAddress}`)
    await kvStore.setBalance(testAddress, testContract, testBalance)
    console.log('✅ Set balance successful')
    
    console.log(`📥 Getting balance for ${testContract} of ${testAddress}`)
    const retrievedBalance = await kvStore.getBalance(testAddress, testContract)
    console.log('✅ Get balance successful:', retrievedBalance)
    
    // Test getting all balances for address
    console.log(`📥 Getting all balances for ${testAddress}`)
    const addressBalances = await kvStore.getAddressBalances(testAddress)
    console.log('✅ Get address balances successful:', addressBalances)

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