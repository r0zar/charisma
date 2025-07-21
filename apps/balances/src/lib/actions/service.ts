'use server'

import { BalanceService, KVBalanceStore, type KvBalanceStats } from '@services/balances'
import { listTokens } from '@repo/tokens'

export interface ServiceStats extends KvBalanceStats {
  status: 'healthy' | 'degraded' | 'unhealthy'
}

export interface CollectionRunResult {
  success: boolean
  snapshotsCreated: number
  addressesProcessed: number
  duration: number
  errors?: string[]
}

// Check if services are configured
function areServicesConfigured(): boolean {
  return !!(process.env.KV_URL && process.env.BLOB_READ_WRITE_TOKEN)
}

// Fallback stats when services are not configured
const fallbackStats: ServiceStats = {
  totalSnapshots: 0,
  totalAddresses: 0,
  totalTokens: 0,
  lastUpdate: new Date().toISOString(),
  status: 'unhealthy'
}

let balanceService: BalanceService | null = null
let kvStore: KVBalanceStore | null = null
if (areServicesConfigured()) {
  try {
    kvStore = new KVBalanceStore()
    balanceService = new BalanceService(kvStore)
  } catch (error) {
    console.warn('Balance service not available:', error)
  }
}

export async function getServiceStats(): Promise<ServiceStats> {
  try {
    if (!balanceService || !kvStore) {
      return fallbackStats
    }

    // Get all stats from KV store including snapshots
    const kvStats = await kvStore.getStats()

    return {
      ...kvStats,
      status: 'healthy'
    }
  } catch (error) {
    console.error('Failed to get service stats:', error)
    return {
      ...fallbackStats,
      status: 'degraded'
    }
  }
}

export async function runCollection(): Promise<CollectionRunResult> {
  try {
    if (!balanceService || !kvStore) {
      throw new Error('Balance service not configured - missing KV_URL or BLOB_READ_WRITE_TOKEN')
    }

    const startTime = Date.now()
    const errors: string[] = []
    let addressesProcessed = 0
    const snapshotsCreated = 0

    // Get all known contracts from the token registry
    let allKnownContracts: string[] = []
    try {
      const allTokens = await listTokens()
      allKnownContracts = allTokens
        .map(token => token.contractId)
        .filter(contractId => contractId && contractId.includes('.'))

      if (allKnownContracts.length === 0) {
        errors.push('No contracts found in token registry')
      }
    } catch (error) {
      errors.push(`Failed to fetch token registry: ${error}`)
      // Fall back to existing addresses approach
    }

    // Get all addresses that have balances
    const addresses = await kvStore.getAllAddresses()

    if (addresses.length === 0) {
      return {
        success: allKnownContracts.length > 0,
        snapshotsCreated: 0,
        addressesProcessed: 0,
        duration: Date.now() - startTime,
        errors: ['No addresses found to process']
      }
    }

    // Process addresses in batches for efficiency
    const batchSize = 25 // Reduced batch size since we're doing more work per address
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize)

      try {
        // For each address, check balances for all known contracts
        const batchPromises = batch.map(async (address) => {
          try {
            if (allKnownContracts.length > 0) {
              // Use comprehensive approach: check against all known contracts
              const contractBatchSize = 10
              for (let j = 0; j < allKnownContracts.length; j += contractBatchSize) {
                const contractBatch = allKnownContracts.slice(j, j + contractBatchSize)
                await Promise.all(contractBatch.map(async (contractId) => {
                  try {
                    await balanceService.getBalance(address, contractId)
                  } catch (error) {
                    // Ignore individual contract failures - they may not exist for this address
                  }
                }))
              }
            } else {
              // Fall back to existing approach
              await balanceService.getAllBalances(address)
            }
            return address
          } catch (error) {
            errors.push(`Failed to process address ${address}: ${error}`)
            return null
          }
        })

        const results = await Promise.all(batchPromises)
        addressesProcessed += results.filter(r => r !== null).length
      } catch (error) {
        errors.push(`Failed to process batch: ${error}`)
      }
    }

    const duration = Date.now() - startTime
    const success = errors.length === 0

    return {
      success,
      snapshotsCreated,
      addressesProcessed,
      duration,
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error) {
    console.error('Failed to run collection:', error)
    throw error
  }
}