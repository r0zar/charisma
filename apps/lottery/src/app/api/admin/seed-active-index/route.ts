import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { blobStorage } from '@/lib/blob-storage'

function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY

  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return false
  }

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

const ALL_ACTIVE_TICKETS_KEY = 'all_active_tickets'
const TICKET_PREFIX = 'lottery:ticket:'
const WALLET_TICKETS_PREFIX = 'lottery:wallet:'
const DRAW_TICKETS_PREFIX = 'lottery:draw:'

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting active tickets index seeding and KV migration...')

    // Get all tickets from blob storage
    const allTickets = await blobStorage.getAllLotteryTickets()
    console.log(`Found ${allTickets.length} total tickets`)

    // Filter to active tickets only (not archived)
    const activeTickets = allTickets.filter(ticket => ticket.drawStatus !== 'archived')
    console.log(`Found ${activeTickets.length} active tickets to seed`)

    if (activeTickets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active tickets found to seed',
        seeded: 0
      })
    }

    console.log('Migrating tickets to KV storage...')

    // Save all active tickets to KV in batches of 100 for efficiency
    const batchSize = 100
    for (let i = 0; i < activeTickets.length; i += batchSize) {
      const batch = activeTickets.slice(i, i + batchSize)
      const pipeline = kv.pipeline()

      for (const ticket of batch) {
        // 1. Store the ticket data
        pipeline.set(`${TICKET_PREFIX}${ticket.id}`, ticket, { ex: 60 * 60 * 24 * 60 }) // 60 days TTL

        // 2. Add to wallet index
        pipeline.sadd(`${WALLET_TICKETS_PREFIX}${ticket.walletAddress}`, ticket.id)
        pipeline.expire(`${WALLET_TICKETS_PREFIX}${ticket.walletAddress}`, 60 * 60 * 24 * 60)

        // 3. Add to draw index if drawId exists
        if (ticket.drawId) {
          pipeline.sadd(`${DRAW_TICKETS_PREFIX}${ticket.drawId}`, ticket.id)
          pipeline.expire(`${DRAW_TICKETS_PREFIX}${ticket.drawId}`, 60 * 60 * 24 * 60)
        }

        // 4. Add to global active tickets index
        pipeline.sadd(ALL_ACTIVE_TICKETS_KEY, ticket.id)
      }

      await pipeline.exec()
      console.log(`Migrated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activeTickets.length / batchSize)}`)
    }

    console.log(`Successfully migrated ${activeTickets.length} active tickets to KV and seeded index`)

    return NextResponse.json({
      success: true,
      message: 'Active tickets migrated to KV and index seeded successfully',
      seeded: activeTickets.length,
      tickets: activeTickets.map(t => ({
        id: t.id,
        status: t.status,
        walletAddress: t.walletAddress,
        drawId: t.drawId
      }))
    })
  } catch (error) {
    console.error('Seed active index error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed active index' },
      { status: 500 }
    )
  }
}
