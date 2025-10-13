import { NextRequest, NextResponse } from 'next/server'
import { kvTicketStorage } from '@/lib/kv-ticket-storage'
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

    // Get instant current draw stats from KV counters
    const kvStats = await kvTicketStorage.getStats()

    // Get draw count from blob storage
    const draws = await hybridStorage.getAllLotteryDraws()
    const completedDraws = draws.filter(d => d.status === 'completed').length

    // Get total lifetime ticket count from blob storage (includes archived)
    // This is cached and relatively fast with pagination
    const allTickets = await hybridStorage.getAllLotteryTickets()
    const lifetimeConfirmed = allTickets.filter(t => t.status === 'confirmed').length
    const lifetimeUniqueWallets = new Set(allTickets.map(t => t.walletAddress)).size

    const stats = {
      // Current draw stats (from KV - fast)
      currentDrawTickets: kvStats.totalTickets,
      currentDrawConfirmed: kvStats.confirmedTickets,
      currentDrawPending: kvStats.pendingTickets,
      currentDrawCancelled: kvStats.cancelledTickets,
      currentDrawUniqueWallets: kvStats.uniqueWallets,

      // Lifetime stats (from blob - slower but acceptable)
      totalTickets: allTickets.length,
      confirmedTickets: lifetimeConfirmed,
      uniqueWallets: lifetimeUniqueWallets,

      // Draw stats
      totalDraws: draws.length,
      completedDraws,
      averageTicketsPerDraw: draws.length > 0 ? Math.round(lifetimeConfirmed / draws.length) : 0,

      // Placeholder for future implementation
      recentConfirmedTickets: 0,
      recentDraws: 0
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
