import { NextRequest, NextResponse } from 'next/server'
import { KVBalanceStore } from '@services/balances'

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Getting address discovery statistics...')
    
    const balanceStore = new KVBalanceStore()

    // Get auto-discovered addresses
    const autoDiscoveredAddresses = await balanceStore.getAutoDiscoveredAddresses()
    
    // Get whale addresses by classification
    const smallWhales = await balanceStore.getWhaleAddresses('small')
    const mediumWhales = await balanceStore.getWhaleAddresses('medium')
    const largeWhales = await balanceStore.getWhaleAddresses('large')
    const megaWhales = await balanceStore.getWhaleAddresses('mega')
    
    // Get addresses by discovery source
    const tokenHolderAddresses = await balanceStore.getAddressesBySource('token_holders')
    const whaleDetectionAddresses = await balanceStore.getAddressesBySource('whale_detection')
    const contractAddresses = await balanceStore.getAddressesBySource('contract_addresses')
    const manualAddresses = await balanceStore.getAddressesBySource('manual')

    // Get overall stats
    const stats = await balanceStore.getStats()

    // Build comprehensive statistics
    const discoveryStats = {
      totalAddresses: stats.totalAddresses,
      autoDiscoveredCount: autoDiscoveredAddresses.length,
      manualAddressCount: manualAddresses.length,
      
      whaleStats: {
        total: smallWhales.length + mediumWhales.length + largeWhales.length + megaWhales.length,
        small: smallWhales.length,
        medium: mediumWhales.length,
        large: largeWhales.length,
        mega: megaWhales.length
      },
      
      discoverySourceStats: {
        token_holders: tokenHolderAddresses.length,
        whale_detection: whaleDetectionAddresses.length,
        contract_addresses: contractAddresses.length,
        manual: manualAddresses.length
      },
      
      coverageRate: stats.totalAddresses > 0 ? 
        (autoDiscoveredAddresses.length / stats.totalAddresses) * 100 : 0,
      
      lastUpdate: stats.lastUpdate
    }

    return NextResponse.json({
      success: true,
      stats: discoveryStats,
      addresses: {
        autoDiscovered: autoDiscoveredAddresses,
        whales: {
          small: smallWhales,
          medium: mediumWhales, 
          large: largeWhales,
          mega: megaWhales
        }
      }
    })

  } catch (error) {
    console.error('❌ Discovery stats API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get discovery statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Reset auto-discovery metadata (for testing/debugging)
    console.log('🧹 Resetting auto-discovery metadata...')
    
    const balanceStore = new KVBalanceStore()
    const autoDiscoveredAddresses = await balanceStore.getAutoDiscoveredAddresses()

    let resetCount = 0
    for (const address of autoDiscoveredAddresses) {
      const metadata = await balanceStore.getAddressMetadata(address)
      if (metadata) {
        // Keep core metadata, remove auto-discovery metadata
        await balanceStore.setAddressMetadata(address, {
          contracts: metadata.contracts,
          lastSync: metadata.lastSync,
          // Remove auto-discovery fields
          autoDiscovered: undefined,
          discoverySource: undefined,
          discoveryMetadata: undefined,
          autoCollectionEnabled: undefined,
          whaleClassification: undefined,
          totalValueUSD: undefined,
          lastWhaleUpdate: undefined
        })
        resetCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reset auto-discovery metadata for ${resetCount} addresses`,
      resetCount
    })

  } catch (error) {
    console.error('❌ Discovery reset API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to reset discovery metadata',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}