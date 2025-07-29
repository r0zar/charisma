import { NextRequest, NextResponse } from 'next/server'
import { blobStorage } from '@/lib/blob-storage'
import { lotteryConfigService } from '@/lib/lottery-config'
import { ticketService } from '@/lib/ticket-service'
import { LotteryDraw, WinnerInfo, LotteryTicket } from '@/types/lottery'

function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  
  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return false
  }

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

function generateDrawId(): string {
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  return `draw-${timestamp}-${randomSuffix}`
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const requestBody = await request.json()
    const { winningTicketId, drawId: providedDrawId } = requestBody
    
    console.log('Manual winner selection requested for ticket:', winningTicketId)

    if (!winningTicketId) {
      return NextResponse.json(
        { error: 'Winning ticket ID is required' },
        { status: 400 }
      )
    }

    // Get current lottery configuration
    const config = await lotteryConfigService.getConfig()
    
    // Get all active (non-archived) tickets for the next draw
    const nextDrawId = await ticketService.getNextDrawId()
    const allTickets = await ticketService.getTicketsByDraw(nextDrawId, false)
    
    // Only process confirmed tickets for the draw
    const tickets = allTickets.filter(ticket => ticket.status === 'confirmed')
    
    console.log(`Found ${allTickets.length} total tickets (${tickets.length} confirmed) for draw ${nextDrawId}`)
    
    if (tickets.length === 0) {
      return NextResponse.json(
        { error: 'Cannot create draw: No confirmed tickets available' },
        { status: 400 }
      )
    }

    // Find the winning ticket
    const winningTicket = tickets.find(ticket => ticket.id === winningTicketId)
    
    if (!winningTicket) {
      return NextResponse.json(
        { error: `Winning ticket ${winningTicketId} not found in confirmed tickets for current draw` },
        { status: 404 }
      )
    }

    console.log(`Manual winner selected: Ticket ${winningTicket.id} for wallet ${winningTicket.walletAddress}`)

    // Generate draw details
    const drawId = providedDrawId || generateDrawId()
    const drawDate = new Date().toISOString()
    
    // For simple format lottery, we don't need actual numbers - just the winning ticket
    // Use empty array for numbers since simple format doesn't use number matching
    const winningNumbers: number[] = []
    
    // Create winner info - for simple format it's just one winner
    const winners: WinnerInfo[] = [{
      tier: 1,
      matchCount: 0, // Not applicable for simple format
      winnerCount: 1,
      prizePerWinner: config.currentJackpot.estimatedValue || 0,
      totalPrize: config.currentJackpot.estimatedValue || 0
    }]
    
    // Create the draw record with manual selection metadata
    const draw: LotteryDraw = {
      id: drawId,
      drawDate,
      winningNumbers,
      jackpotAmount: config.currentJackpot,
      totalTicketsSold: tickets.length,
      winners,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save the draw to blob storage
    await blobStorage.saveLotteryDraw(draw)
    
    // Archive all tickets for this draw and mark the winner
    console.log(`Archiving ${tickets.length} tickets for completed draw ${nextDrawId}`)
    for (const ticket of tickets) {
      try {
        const archivedTicket = {
          ...ticket,
          status: 'archived' as const,
          drawResult: drawId,
          isWinner: ticket.id === winningTicketId // Mark the winning ticket
        }
        await blobStorage.saveLotteryTicket(archivedTicket)
        console.log(`Archived ticket ${ticket.id}${ticket.id === winningTicketId ? ' (WINNER)' : ''}`)
      } catch (error) {
        console.error(`Failed to archive ticket ${ticket.id}:`, error)
        // Continue with other tickets even if one fails
      }
    }
    
    console.log(`Manual draw completed successfully:`, draw)
    console.log(`Manual winner: Ticket ${winningTicketId}`)
    console.log(`Tickets archived: ${tickets.length}`)
    
    return NextResponse.json({
      success: true,
      data: draw,
      metadata: {
        manualSelection: true,
        winningTicketId,
        winnerWallet: winningTicket.walletAddress,
        ticketsProcessed: tickets.length,
        ticketsArchived: tickets.length,
        currentJackpot: config.currentJackpot.title
      }
    })
  } catch (error) {
    console.error('Manual winner selection error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: `Failed to select manual winner: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}