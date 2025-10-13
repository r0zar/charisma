import { NextRequest, NextResponse } from 'next/server'
import { ticketService } from '@/lib/ticket-service'
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
    // Admin authentication required
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const drawId = searchParams.get('drawId')
    const walletAddress = searchParams.get('walletAddress')
    const ticketId = searchParams.get('ticketId')
    const activeOnly = searchParams.get('activeOnly') === 'true'
    
    if (ticketId) {
      // Get specific ticket
      const ticket = await ticketService.getTicket(ticketId)
      
      if (!ticket) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        data: ticket
      })
    } else if (drawId) {
      // Get tickets for specific draw
      const tickets = await ticketService.getTicketsByDraw(drawId)
      const stats = await ticketService.getTicketStats(drawId)
      
      return NextResponse.json({
        success: true,
        data: tickets,
        count: tickets.length,
        stats
      })
    } else if (walletAddress) {
      // Get tickets for specific wallet
      const tickets = await ticketService.getTicketsByWallet(walletAddress)
      
      return NextResponse.json({
        success: true,
        data: tickets,
        count: tickets.length
      })
    } else {
      // Get all tickets with optional stats
      // Use fast KV lookup for active-only queries
      const tickets = activeOnly
        ? await hybridStorage.getAllActiveTickets()
        : await hybridStorage.getAllLotteryTickets()

      // Skip expensive stats calculation for active-only queries
      const stats = activeOnly
        ? undefined
        : await ticketService.getTicketStats()

      return NextResponse.json({
        success: true,
        data: tickets,
        count: tickets.length,
        ...(stats && { stats })
      })
    }
  } catch (error) {
    console.error('Admin GET lottery tickets error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('ticketId')
    
    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      )
    }

    // Check if ticket exists
    const existingTicket = await ticketService.getTicket(ticketId)
    
    if (!existingTicket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    await hybridStorage.deleteLotteryTicket(ticketId)
    console.log('Ticket deleted successfully:', ticketId)
    
    return NextResponse.json({
      success: true,
      message: `Ticket ${ticketId} deleted successfully`
    })
  } catch (error) {
    console.error('Admin DELETE lottery ticket error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}