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

    // Get instant stats from KV counters
    const kvStats = await kvTicketStorage.getStats()

    // Get draw count from blob storage (cached/fast)
    const draws = await hybridStorage.getAllLotteryDraws()
    const completedDraws = draws.filter(d => d.status === 'completed').length

    // Calculate recent activity (last 30 days) - this would need to be cached or counters too
    // For now, we'll return 0 and implement later
    const stats = {
      totalTickets: kvStats.totalTickets,
      confirmedTickets: kvStats.confirmedTickets,
      pendingTickets: kvStats.pendingTickets,
      cancelledTickets: kvStats.cancelledTickets,
      uniqueWallets: kvStats.uniqueWallets,
      totalDraws: draws.length,
      completedDraws,
      // These would need additional counters or caching:
      recentConfirmedTickets: 0,
      recentDraws: 0,
      averageTicketsPerDraw: draws.length > 0 ? Math.round(kvStats.confirmedTickets / draws.length) : 0
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
