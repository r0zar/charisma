import { NextRequest, NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'
import { LotteryTicket } from '@/types/lottery'

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

    const { ticketId, newStatus, note, adminOverride } = await request.json()

    console.log('Status update request:', { ticketId, newStatus, note, adminOverride })

    if (!ticketId || !newStatus) {
      return NextResponse.json(
        { error: 'Ticket ID and new status are required' },
        { status: 400 }
      )
    }

    if (!['pending', 'confirmed', 'cancelled'].includes(newStatus)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, confirmed, or cancelled' },
        { status: 400 }
      )
    }

    // Get the ticket
    const ticket = await hybridStorage.getLotteryTicket(ticketId)
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Check if status is already the same
    if (ticket.status === newStatus) {
      return NextResponse.json(
        { error: `Ticket is already ${newStatus}` },
        { status: 400 }
      )
    }

    // Build updated ticket
    const updatedTicket: LotteryTicket = {
      ...ticket,
      status: newStatus as 'pending' | 'confirmed' | 'cancelled'
    }

    // Update timestamps based on new status
    const now = new Date().toISOString()
    if (newStatus === 'confirmed') {
      updatedTicket.confirmedAt = ticket.confirmedAt || now
    } else if (newStatus === 'cancelled') {
      updatedTicket.cancelledAt = now
      // Clear confirmation data if reverting from confirmed
      if (ticket.status === 'confirmed') {
        delete updatedTicket.confirmedAt
      }
    } else if (newStatus === 'pending') {
      // Clear status-specific timestamps when reverting to pending
      delete updatedTicket.confirmedAt
      delete updatedTicket.cancelledAt
    }

    // Log admin override action
    console.log('ADMIN STATUS OVERRIDE:', {
      ticketId,
      oldStatus: ticket.status,
      newStatus,
      adminNote: note || 'No note provided',
      timestamp: now
    })

    // Save updated ticket
    await hybridStorage.saveLotteryTicket(updatedTicket)

    console.log(`Ticket ${ticketId} status updated from ${ticket.status} to ${newStatus}`)

    return NextResponse.json({
      success: true,
      data: {
        ticketId,
        oldStatus: ticket.status,
        newStatus,
        updatedAt: now
      }
    })
  } catch (error) {
    console.error('Update ticket status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update ticket status' },
      { status: 500 }
    )
  }
}
