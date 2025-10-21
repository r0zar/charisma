import { NextRequest, NextResponse } from 'next/server'
import { kvStorage } from '@/lib/kv-storage'
import { hybridStorage } from '@/lib/hybrid-storage'

function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY

  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return false
  }

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if we only need current draw stats (fast KV-only query)
    const { searchParams } = new URL(request.url)
    const currentOnly = searchParams.get('currentOnly') === 'true'

    // Get instant current draw stats from KV counters (always fast)
    const kvStats = await kvStorage.getStats()

    const stats: any = {
      // Current draw stats (from KV counters - instant)
      currentDrawTickets: kvStats.totalTickets,
      currentDrawConfirmed: kvStats.confirmedTickets,
      currentDrawPending: kvStats.pendingTickets,
      currentDrawCancelled: kvStats.cancelledTickets,
      currentDrawUniqueWallets: kvStats.uniqueWallets,
    }

    // Only fetch lifetime stats if requested (now queries KV on-demand)
    if (!currentOnly) {
      // Get draw count from KV
      const draws = await hybridStorage.getAllLotteryDraws()
      const completedDraws = draws.filter(d => d.status === 'completed').length

      // Get total lifetime ticket count from KV (all tickets, no blob storage)
      const allTickets = await hybridStorage.getAllLotteryTickets()
      const lifetimeConfirmed = allTickets.filter(t => t.status === 'confirmed').length
      const lifetimeUniqueWallets = new Set(allTickets.map(t => t.walletAddress)).size

      // Add lifetime stats (now fast - all from KV)
      stats.totalTickets = allTickets.length
      stats.confirmedTickets = lifetimeConfirmed
      stats.uniqueWallets = lifetimeUniqueWallets
      stats.totalDraws = draws.length
      stats.completedDraws = completedDraws
      stats.averageTicketsPerDraw = draws.length > 0 ? Math.round(lifetimeConfirmed / draws.length) : 0
      stats.recentConfirmedTickets = 0 // Placeholder
      stats.recentDraws = 0 // Placeholder
    }

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Admin GET stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
