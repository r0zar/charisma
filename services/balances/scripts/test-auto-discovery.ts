#!/usr/bin/env node
/**
 * Test Auto-Discovery Feature
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { BalanceService, KVBalanceStore } from '../src/index'

async function testAutoDiscovery() {
  console.log('🔍 Testing Auto-Discovery Feature...')
  
  try {
    // Create BalanceService with auto-discovery enabled
    console.log('📦 Creating BalanceService with auto-discovery enabled...')
    const balanceService = new BalanceService(
      new KVBalanceStore(),
      undefined,
      { 
        enableAutoDiscovery: true,
        discoveryConfig: {
          enableAutoCollection: true
        }
      }
    )
    console.log('✅ BalanceService created')

    // Test 1: Check auto-discovery status
    console.log('\n📊 Test 1: Check auto-discovery status')
    const isEnabled = balanceService.isAutoDiscoveryEnabled()
    console.log(`Auto-discovery enabled: ${isEnabled}`)

    // Test 2: Get stats before adding any address
    console.log('\n📊 Test 2: Get initial auto-discovery stats')
    const initialStats = await balanceService.getAutoDiscoveryStats()
    console.log('Initial stats:', initialStats)

    // Test 3: Request balance for a new address (should trigger auto-discovery)
    console.log('\n🔍 Test 3: Request balance for new address (should auto-discover)')
    const testAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS' // Well-known address
    const testContract = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
    
    console.log(`Requesting balance for ${testContract} of ${testAddress}`)
    const balance = await balanceService.getBalance(testAddress, testContract)
    console.log(`Balance: ${balance}`)

    // Test 4: Check stats after auto-discovery
    console.log('\n📊 Test 4: Check stats after auto-discovery')
    const afterStats = await balanceService.getAutoDiscoveryStats()
    console.log('After auto-discovery stats:', afterStats)

    // Test 5: Request balances for the same address again (should not trigger auto-discovery)
    console.log('\n🔍 Test 5: Request balance again (should not auto-discover)')
    const balance2 = await balanceService.getBalance(testAddress, testContract)
    console.log(`Balance (second request): ${balance2}`)

    // Test 6: Manually add an address
    console.log('\n✋ Test 6: Manually add an address')
    const manualAddress = 'SP1HTBVD3JG9C05J7HBJTHGR0GGS7RH5C1QB6K9VD'
    await balanceService.addAddress(manualAddress, {
      discoverySource: 'manual',
      autoDiscovered: false
    })
    console.log(`Manually added: ${manualAddress}`)

    // Test 7: Final stats
    console.log('\n📊 Test 7: Final auto-discovery stats')
    const finalStats = await balanceService.getAutoDiscoveryStats()
    console.log('Final stats:', finalStats)

    // Test 8: Test disabling auto-discovery
    console.log('\n🛑 Test 8: Disable auto-discovery')
    balanceService.setAutoDiscovery(false)
    console.log(`Auto-discovery disabled: ${!balanceService.isAutoDiscoveryEnabled()}`)

    // Test 9: Request balance with auto-discovery disabled
    console.log('\n🔍 Test 9: Request balance with auto-discovery disabled')
    const disabledTestAddress = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9'
    const balance3 = await balanceService.getBalance(disabledTestAddress, testContract)
    console.log(`Balance with auto-discovery disabled: ${balance3}`)

    console.log('\n✅ Auto-discovery test completed successfully!')

  } catch (error) {
    console.error('❌ Auto-discovery test failed:', error)
    process.exit(1)
  }
}

testAutoDiscovery().catch(console.error)