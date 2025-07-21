import { NextRequest, NextResponse } from 'next/server'
import { AddressDiscoveryService, KVBalanceStore } from '@services/balances'

// Verify this is a cron request from Vercel
function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET
  
  // In development, allow requests without auth
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔓 Development mode - allowing cron request without auth')
    return true
  }

  if (!expectedToken) {
    console.warn('CRON_SECRET not set in production - rejecting request')
    return false
  }

  const isValid = authHeader === `Bearer ${expectedToken}`
  console.log(`🔐 Auth check: ${isValid ? 'valid' : 'invalid'}`)
  return isValid
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify this is a legitimate cron request
    if (!verifyCronRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🕒 Starting scheduled address discovery...')

    // Initialize services
    const balanceStore = new KVBalanceStore()
    const discoveryService = new AddressDiscoveryService(balanceStore, {
      includeContractAddresses: true,
      contractTypes: ['defi', 'dao', 'sip-010'],
      maxContractsToScan: 25,
      maxHoldersPerToken: 30,
      topHolderPercentage: 35,
      enableAutoCollection: true,
      batchSize: 10,
      minTokenBalance: '1000',
      includeSmallHolders: false
    })

    // Run discovery
    const result = await discoveryService.runDiscovery()

    const executionTime = Date.now() - startTime

    // Log results for monitoring
    const resultCount = result.results ? result.results.length : 0
    console.log('✅ Scheduled discovery completed:', {
      success: result.success,
      totalAddresses: resultCount,
      successRate: result.stats?.successRate || 0,
      executionTimeMs: executionTime,
      timestamp: new Date().toISOString()
    })

    // Get updated stats after discovery
    const updatedStats = await balanceStore.getStats()

    return NextResponse.json({
      success: true,
      discovery: result,
      stats: updatedStats,
      execution: {
        startTime: new Date(startTime).toISOString(),
        executionTimeMs: executionTime,
        completedAt: new Date().toISOString()
      },
      message: 'Scheduled discovery completed successfully'
    })

  } catch (error) {
    const executionTime = Date.now() - startTime
    console.error('❌ Scheduled discovery failed:', error)

    return NextResponse.json({
      success: false,
      error: 'Discovery failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      execution: {
        startTime: new Date(startTime).toISOString(),
        executionTimeMs: executionTime,
        failedAt: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}