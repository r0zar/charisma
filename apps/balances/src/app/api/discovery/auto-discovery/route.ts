import { NextRequest, NextResponse } from 'next/server'
import { BalanceService, KVBalanceStore } from '@services/balances'

const balanceService = new BalanceService(new KVBalanceStore(), undefined, {
  enableAutoDiscovery: true,
  discoveryConfig: {
    enableAutoCollection: true
  }
})

export async function GET(request: NextRequest) {
  try {
    const stats = await balanceService.getAutoDiscoveryStats()
    
    return NextResponse.json({
      status: 'success',
      data: stats,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Failed to get auto-discovery stats:', error)
    return NextResponse.json({
      status: 'error',
      error: 'Failed to fetch auto-discovery statistics',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, address, metadata } = body

    if (action === 'toggle') {
      const { enabled } = body
      balanceService.setAutoDiscovery(enabled)
      
      return NextResponse.json({
        status: 'success',
        message: `Auto-discovery ${enabled ? 'enabled' : 'disabled'}`,
        enabled: balanceService.isAutoDiscoveryEnabled()
      })
    }

    if (action === 'add' && address) {
      await balanceService.addAddress(address, metadata)
      
      return NextResponse.json({
        status: 'success',
        message: `Address ${address} added to system`,
        address
      })
    }

    return NextResponse.json({
      status: 'error',
      error: 'Invalid action or missing parameters'
    }, { status: 400 })
  } catch (error) {
    console.error('Failed to process auto-discovery action:', error)
    return NextResponse.json({
      status: 'error',
      error: 'Failed to process auto-discovery action',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 })
  }
}