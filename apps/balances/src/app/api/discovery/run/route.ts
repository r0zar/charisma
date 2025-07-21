import { NextRequest, NextResponse } from 'next/server'
import { AddressDiscoveryService } from '@services/balances'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Starting address discovery via API...')
    
    // Parse request body for any configuration options
    const body = await request.json().catch(() => ({}))
    const config = body.config || {}

    // Create discovery service with optional configuration
    const discoveryService = new AddressDiscoveryService(undefined, config)

    // Check if discovery is already running
    if (discoveryService.isDiscoveryRunning()) {
      return NextResponse.json({
        success: false,
        error: 'Discovery already in progress',
        isRunning: true
      }, { status: 409 })
    }

    // Run discovery
    const results = await discoveryService.runDiscovery()

    // Get discovery statistics
    const stats = discoveryService.getStats()

    console.log('✅ Discovery completed via API:', {
      totalResults: results.length,
      successfulResults: results.filter(r => r.success).length,
      stats
    })

    return NextResponse.json({
      success: true,
      results,
      stats,
      summary: {
        totalAddressesDiscovered: stats.totalAddressesDiscovered,
        successRate: stats.successRate,
        executionTime: stats.avgDiscoveryTime
      }
    })

  } catch (error) {
    console.error('❌ Discovery API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to run address discovery',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Return discovery service status and statistics
    const discoveryService = new AddressDiscoveryService()
    
    const stats = discoveryService.getStats()
    const config = discoveryService.getConfig()
    const isRunning = discoveryService.isDiscoveryRunning()

    return NextResponse.json({
      success: true,
      isRunning,
      stats,
      config,
      status: isRunning ? 'running' : 'idle'
    })

  } catch (error) {
    console.error('❌ Discovery status API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get discovery status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}