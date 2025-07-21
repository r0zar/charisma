#!/usr/bin/env node
/**
 * Verify Token Contracts - Check that all major ecosystem tokens exist and are valid SIP-010 contracts
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env.local') })

// Test with just the token we know was working in our discovery earlier
const MAJOR_ECOSYSTEM_TOKENS = [
  'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.arkadiko-token', // DIKO - we found holders from this earlier
]

interface ContractVerificationResult {
  contractId: string
  exists: boolean
  isSIP010: boolean
  name?: string
  symbol?: string
  decimals?: number
  error?: string
}

async function verifyContract(contractId: string): Promise<ContractVerificationResult> {
  try {
    console.log(`🔍 Verifying ${contractId}...`)

    // Check if contract exists and get interface
    const contractUrl = `https://api.hiro.so/v1/contracts/${contractId}`
    const contractResponse = await fetch(contractUrl)
    
    if (!contractResponse.ok) {
      return {
        contractId,
        exists: false,
        isSIP010: false,
        error: `HTTP ${contractResponse.status}: ${contractResponse.statusText}`
      }
    }

    const contractData = await contractResponse.json()
    
    // Check if contract has SIP-010 functions
    const contractSource = contractData.source_code || ''
    const abi = contractData.abi || {}
    
    // Look for required SIP-010 functions
    const requiredFunctions = ['transfer', 'get-balance', 'get-total-supply', 'get-name', 'get-symbol', 'get-decimals']
    const availableFunctions = abi.functions ? abi.functions.map((f: any) => f.name) : []
    
    const hasSIP010Functions = requiredFunctions.some(fn => 
      availableFunctions.includes(fn) || contractSource.includes(`define-public (${fn}`)
    )

    let tokenInfo: any = {}
    
    // Try to get token metadata
    if (hasSIP010Functions) {
      try {
        // Call get-name, get-symbol, get-decimals functions
        const callUrl = `https://api.hiro.so/v1/contracts/call-read/${contractId}/get-name`
        const nameResponse = await fetch(callUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: contractId.split('.')[0], arguments: [] })
        })
        
        if (nameResponse.ok) {
          const nameData = await nameResponse.json()
          if (nameData.okay && nameData.result) {
            tokenInfo.name = nameData.result.replace(/^"(.*)"$/, '$1') // Remove quotes
          }
        }

        const symbolUrl = `https://api.hiro.so/v1/contracts/call-read/${contractId}/get-symbol`
        const symbolResponse = await fetch(symbolUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: contractId.split('.')[0], arguments: [] })
        })
        
        if (symbolResponse.ok) {
          const symbolData = await symbolResponse.json()
          if (symbolData.okay && symbolData.result) {
            tokenInfo.symbol = symbolData.result.replace(/^"(.*)"$/, '$1') // Remove quotes
          }
        }

        const decimalsUrl = `https://api.hiro.so/v1/contracts/call-read/${contractId}/get-decimals`
        const decimalsResponse = await fetch(decimalsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: contractId.split('.')[0], arguments: [] })
        })
        
        if (decimalsResponse.ok) {
          const decimalsData = await decimalsResponse.json()
          if (decimalsData.okay && decimalsData.result) {
            tokenInfo.decimals = parseInt(decimalsData.result.replace('u', ''))
          }
        }
        
      } catch (metadataError) {
        console.warn(`  ⚠️ Could not fetch metadata for ${contractId}:`, metadataError.message)
      }
    }

    return {
      contractId,
      exists: true,
      isSIP010: hasSIP010Functions,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals
    }

  } catch (error) {
    return {
      contractId,
      exists: false,
      isSIP010: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function verifyAllContracts() {
  console.log('🧪 Verifying Major Ecosystem Token Contracts')
  console.log('='.repeat(60))
  console.log(`📋 Checking ${MAJOR_ECOSYSTEM_TOKENS.length} contracts...\n`)

  const results: ContractVerificationResult[] = []
  
  // Verify contracts with rate limiting
  for (let i = 0; i < MAJOR_ECOSYSTEM_TOKENS.length; i++) {
    const contractId = MAJOR_ECOSYSTEM_TOKENS[i]
    
    try {
      const result = await verifyContract(contractId)
      results.push(result)
      
      // Status indicator
      const status = result.exists 
        ? (result.isSIP010 ? '✅' : '⚠️') 
        : '❌'
      
      console.log(`${status} ${contractId}`)
      if (result.name || result.symbol) {
        console.log(`    Name: ${result.name || 'N/A'} (${result.symbol || 'N/A'}) - ${result.decimals || 'N/A'} decimals`)
      }
      if (result.error) {
        console.log(`    Error: ${result.error}`)
      }
      
      // Rate limiting - wait between requests
      if (i < MAJOR_ECOSYSTEM_TOKENS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
    } catch (error) {
      console.error(`❌ Failed to verify ${contractId}:`, error)
      results.push({
        contractId,
        exists: false,
        isSIP010: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 VERIFICATION SUMMARY')
  console.log('='.repeat(60))
  
  const existingContracts = results.filter(r => r.exists)
  const sip010Contracts = results.filter(r => r.isSIP010)
  const failedContracts = results.filter(r => !r.exists)
  const nonSIP010Contracts = results.filter(r => r.exists && !r.isSIP010)

  console.log(`✅ Total contracts verified: ${results.length}`)
  console.log(`🟢 Existing contracts: ${existingContracts.length}`)  
  console.log(`🪙 Valid SIP-010 contracts: ${sip010Contracts.length}`)
  console.log(`❌ Failed/non-existent: ${failedContracts.length}`)
  console.log(`⚠️  Existing but not SIP-010: ${nonSIP010Contracts.length}`)

  if (failedContracts.length > 0) {
    console.log('\n❌ FAILED CONTRACTS:')
    failedContracts.forEach(contract => {
      console.log(`  • ${contract.contractId}: ${contract.error}`)
    })
  }

  if (nonSIP010Contracts.length > 0) {
    console.log('\n⚠️  NON-SIP010 CONTRACTS:')
    nonSIP010Contracts.forEach(contract => {
      console.log(`  • ${contract.contractId}`)
    })
  }

  console.log('\n🎯 RECOMMENDED ACTIONS:')
  if (failedContracts.length > 0) {
    console.log('  • Remove failed contracts from TokenHolderScanner')
  }
  if (nonSIP010Contracts.length > 0) {
    console.log('  • Review non-SIP010 contracts - they may need special handling')
  }
  if (sip010Contracts.length > 0) {
    console.log(`  • ${sip010Contracts.length} valid SIP-010 contracts ready for discovery scanning`)
  }

  console.log('\n✨ Verification completed!')
  
  return results
}

verifyAllContracts().catch(console.error)