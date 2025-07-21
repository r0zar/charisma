#!/usr/bin/env node
/**
 * Test script for contract address discovery
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

import { 
  ContractAddressScanner,
  KVBalanceStore 
} from '@services/balances'

async function testContractDiscovery() {
  console.log('🧪 Testing Contract Address Discovery...\n')

  try {
    // Test 1: ContractAddressScanner basic functionality
    console.log('🏭 Test 1: ContractAddressScanner functionality')
    const kvStore = new KVBalanceStore()
    
    const contractScanner = new ContractAddressScanner(kvStore, {
      batchSize: 3,
      rateLimitMs: 1000,
      maxConcurrent: 2,
      includeTokenContracts: true,
      includeDeFiContracts: true,
      includeNFTContracts: false
    })

    // Test with limited parameters to avoid API overload
    const contractResults = await contractScanner.scanContractAddresses({
      contractTypes: ['defi', 'dao'], // Focus on DeFi contracts that are more likely to hold tokens
      maxContracts: 5, // Limit to 5 contracts
      onlyWithTokenBalances: true, // Only contracts with actual token holdings
      minTokenBalance: '1' // Very low threshold to catch any holdings
    })

    console.log('✅ Contract address scan completed:', contractResults.length, 'results')
    
    for (const result of contractResults.slice(0, 3)) { // Show first 3 results
      if (result.success && result.hasTokenBalances) {
        console.log(`  🏭 ${result.contractName} (${result.contractType}): ${result.totalTokensHeld} tokens`)
        console.log(`      Address: ${result.address}`)
        if (result.tokenBalances) {
          const topTokens = Object.entries(result.tokenBalances).slice(0, 2)
          for (const [token, balance] of topTokens) {
            console.log(`      💰 ${balance} of ${token.split('.')[1] || token}`)
          }
        }
      }
    }

    // Test cache functionality
    console.log('\n🗂️  Test 2: Cache functionality')
    const cacheStats = contractScanner.getCacheStats()
    console.log('✅ Cache stats:', cacheStats)

    // Test contract lookup by token
    if (contractResults.length > 0 && contractResults[0].tokenBalances) {
      const firstToken = Object.keys(contractResults[0].tokenBalances)[0]
      const contractsHoldingToken = await contractScanner.getContractsHoldingToken(firstToken)
      console.log(`✅ Contracts holding ${firstToken.split('.')[1]}:`, contractsHoldingToken.length)
    }

    // Test 3: Integration with AddressDiscoveryService
    console.log('\n🔍 Test 3: Integration with AddressDiscoveryService')
    const { AddressDiscoveryService } = await import('@services/balances')
    
    const discoveryService = new AddressDiscoveryService(kvStore, {
      includeContractAddresses: true,
      contractTypes: ['defi', 'dao'],
      maxContractsToScan: 3, // Very small number for testing
      maxHoldersPerToken: 2, // Limit token holders too
      enableAutoCollection: false, // Don't auto-add for testing
      batchSize: 2
    })

    const config = discoveryService.getConfig()
    console.log('✅ Discovery service with contract support:', {
      includeContracts: config.includeContractAddresses,
      contractTypes: config.contractTypes,
      maxContracts: config.maxContractsToScan
    })

    console.log('\n🎉 Contract discovery tests completed successfully!')
    console.log('\n💡 To run full discovery with contracts: POST /api/discovery/run')
    console.log('💡 To view contract stats: GET /api/discovery/stats')

  } catch (error) {
    console.error('❌ Contract discovery test failed:', error)
    process.exit(1)
  }
}

testContractDiscovery().catch(console.error)