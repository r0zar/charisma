'use server'

import { KVBalanceStore } from '@services/balances'
import { BalanceService } from '@services/balances'

const kvStore = new KVBalanceStore()
const balanceService = new BalanceService(kvStore)

export async function getBalance(address: string, contractId: string) {
  try {
    if (!address) {
      throw new Error('Address is required')
    }

    if (!contractId) {
      throw new Error('Contract ID is required')
    }

    const balance = await balanceService.getBalance(address, contractId)

    return {
      address,
      contractId,
      balance,
      success: true
    }
  } catch (error) {
    console.error('Balance action error:', error)
    throw error
  }
}

export async function getBalances(address: string, contractIds?: string[]) {
  try {
    if (!address) {
      throw new Error('Address is required')
    }

    const balances = await balanceService.getBalances(address, contractIds)

    return {
      address,
      balances,
      success: true
    }
  } catch (error) {
    console.error('Balances action error:', error)
    throw error
  }
}

export interface BulkBalancesRequest {
  addresses: string[]
  contractIds?: string[]
  includeZeroBalances?: boolean
}

export async function getBulkBalances(request: BulkBalancesRequest) {
  try {
    const { addresses, contractIds, includeZeroBalances } = request

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      throw new Error('Addresses array is required')
    }

    const result = await balanceService.getBulkBalances({
      addresses,
      contractIds,
      includeZeroBalances
    })

    return result
  } catch (error) {
    console.error('Bulk balances action error:', error)
    throw error
  }
}