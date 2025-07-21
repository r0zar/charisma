#!/usr/bin/env node
/**
 * Check what methods are available on KVBalanceStore
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { KVBalanceStore } from '@services/balances'

async function checkKVMethods() {
  console.log('🔍 Checking KVBalanceStore methods...')
  
  try {
    const kvStore = new KVBalanceStore()
    console.log('✅ KVBalanceStore created')

    console.log('\n📋 Available methods:')
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(kvStore))
    methods.forEach(method => {
      if (typeof (kvStore as any)[method] === 'function') {
        console.log(`  - ${method}()`)
      }
    })

    console.log('\n📋 Available properties:')
    Object.keys(kvStore).forEach(prop => {
      console.log(`  - ${prop}:`, typeof (kvStore as any)[prop])
    })

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkKVMethods().catch(console.error)