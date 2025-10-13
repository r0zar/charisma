import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { kvTicketStorage } from '@/lib/kv-ticket-storage'

function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY

  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return false
  }

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Initializing stats counters from existing KV data...')

    // Get all active tickets from KV
    const tickets = await kvTicketStorage.getAllActiveTickets()

    console.log(`Found ${tickets.length} active tickets in KV`)

    // Count by status
    const confirmedCount = tickets.filter(t => t.status === 'confirmed').length
    const pendingCount = tickets.filter(t => t.status === 'pending').length
    const cancelledCount = tickets.filter(t => t.status === 'cancelled').length
    const uniqueWallets = new Set(tickets.map(t => t.walletAddress))

    console.log('Stats:', {
      total: tickets.length,
      confirmed: confirmedCount,
      pending: pendingCount,
      cancelled: cancelledCount,
      uniqueWallets: uniqueWallets.size
    })

    // Initialize counters in KV
    const pipeline = kv.pipeline()

    pipeline.set('stats:total_tickets', tickets.length)
    pipeline.set('stats:confirmed_tickets', confirmedCount)
    pipeline.set('stats:pending_tickets', pendingCount)
    pipeline.set('stats:cancelled_tickets', cancelledCount)

    // Clear and rebuild unique wallets set
    pipeline.del('stats:unique_wallets')
    uniqueWallets.forEach(wallet => {
      pipeline.sadd('stats:unique_wallets', wallet)
    })

    await pipeline.exec()

    console.log('Stats counters initialized successfully')

    return NextResponse.json({
      success: true,
      message: 'Stats counters initialized successfully',
      metadata: {
        totalTickets: tickets.length,
        confirmedTickets: confirmedCount,
        pendingTickets: pendingCount,
        cancelledTickets: cancelledCount,
        uniqueWallets: uniqueWallets.size
      }
    })
  } catch (error) {
    console.error('Admin init-stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
