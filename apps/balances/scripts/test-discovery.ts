#!/usr/bin/env node
/**
 * Test script for address discovery services
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { 
  AddressDiscoveryService, 
  TokenHolderScanner, 
  WhaleDetectionService,
  KVBalanceStore 
} from '@services/balances'

async function testAddressDiscovery() {
  console.log('🧪 Testing Address Discovery Services...\n')

  try {
    // Test 1: KVBalanceStore metadata functionality
    console.log('📦 Test 1: KVBalanceStore metadata functionality')
    const kvStore = new KVBalanceStore()
    
    // Add some test metadata
    await kvStore.setAddressMetadata('SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9', {
      autoDiscovered: true,
      discoverySource: 'token_holders',
      whaleClassification: 'medium',
      totalValueUSD: 25000,
      tags: ['test', 'whale']
    })
    
    // Retrieve metadata
    const metadata = await kvStore.getAddressMetadata('SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9')
    console.log('✅ Metadata stored and retrieved:', metadata?.whaleClassification)
    
    // Test whale address retrieval
    const whaleAddresses = await kvStore.getWhaleAddresses('medium')
    console.log('✅ Found medium whales:', whaleAddresses.length)

    // Test 2: WhaleDetectionService
    console.log('\n🐋 Test 2: WhaleDetectionService')
    const whaleService = new WhaleDetectionService(kvStore, { thresholdUSD: 1000 })
    
    // Test with a known address
    const testAddresses = ['SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9']
    const classifications = await whaleService.classifyAddresses(testAddresses)
    console.log('✅ Whale classification completed:', classifications.length, 'results')
    
    for (const result of classifications) {
      if (result.success) {
        console.log(`  📊 ${result.address}: ${result.classification} (${result.tokenCount} tokens)`)
      }
    }

    // Test 3: TokenHolderScanner
    console.log('\n🪙 Test 3: TokenHolderScanner (limited test)')
    const tokenScanner = new TokenHolderScanner(kvStore, {
      batchSize: 5,
      rateLimitMs: 1000,
      maxConcurrent: 2
    })
    
    // Test with limited parameters to avoid API overload
    const holderResults = await tokenScanner.scanTopHolders({
      topPercentage: 50, // Top 50% to be less aggressive
      maxAddresses: 5,   // Only 5 addresses max
      minBalance: '1000'
    })
    console.log('✅ Token holder scan completed:', holderResults.length, 'results')
    
    for (const result of holderResults.slice(0, 3)) { // Show first 3 results
      if (result.success) {
        console.log(`  💰 ${result.address}: ${result.balance} of ${result.tokenContract}`)
      }
    }

    // Test 4: AddressDiscoveryService (minimal test)
    console.log('\n🔍 Test 4: AddressDiscoveryService (configuration test)')
    const discoveryService = new AddressDiscoveryService(kvStore, {
      minTokenBalance: '5000',
      topHolderPercentage: 20,
      maxHoldersPerToken: 10,
      whaleThresholdUSD: 5000,
      enableAutoCollection: false, // Disable for testing
      batchSize: 3,
      rateLimitMs: 2000
    })
    
    const config = discoveryService.getConfig()
    const stats = discoveryService.getStats()
    const isRunning = discoveryService.isDiscoveryRunning()
    
    console.log('✅ Discovery service initialized')
    console.log('  ⚙️  Config:', { 
      batchSize: config.batchSize, 
      whaleThreshold: config.whaleThresholdUSD,
      autoCollection: config.enableAutoCollection
    })
    console.log('  📈 Stats:', { 
      totalDiscovered: stats.totalAddressesDiscovered,
      isRunning 
    })

    // Test cache and utility functions
    console.log('\n🧹 Test 5: Cache and utility functions')
    
    // Clear token scanner cache
    tokenScanner.clearCache()
    const cacheStats = tokenScanner.getCacheStats()
    console.log('✅ Token scanner cache cleared:', cacheStats)
    
    // Clear whale service price cache
    whaleService.clearPriceCache()
    const priceStats = whaleService.getPriceCacheStats()
    console.log('✅ Price cache cleared:', priceStats)

    console.log('\n🎉 All discovery service tests completed successfully!')
    console.log('\n💡 To run full discovery, use the API endpoint: POST /api/discovery/run')
    console.log('💡 To view discovery stats, use: GET /api/discovery/stats')

  } catch (error) {
    console.error('❌ Discovery test failed:', error)
    process.exit(1)
  }
}

testAddressDiscovery().catch(console.error)