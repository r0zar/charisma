import { NextRequest, NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'
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

async function generateDrawId(): Promise<string> {
  const drawNumber = await hybridStorage.incrementDrawCounter()
  return drawNumber.toString().padStart(6, '0') // Format as 000001, 000002, etc.
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
    
    // Separate confirmed tickets (for archiving) and pending/cancelled tickets (for deletion)
    const confirmedTickets = allTickets.filter(ticket => ticket.status === 'confirmed')
    const pendingTickets = allTickets.filter(ticket => ticket.status === 'pending')
    const cancelledTickets = allTickets.filter(ticket => ticket.status === 'cancelled')
    
    console.log(`Found ${allTickets.length} total tickets:`)
    console.log(`  - ${confirmedTickets.length} confirmed (will be archived)`)
    console.log(`  - ${pendingTickets.length} pending (will be deleted)`)
    console.log(`  - ${cancelledTickets.length} cancelled (will be archived)`)
    
    if (confirmedTickets.length === 0) {
      return NextResponse.json(
        { error: 'Cannot create draw: No confirmed tickets available' },
        { status: 400 }
      )
    }

    // Find the winning ticket (must be from confirmed tickets)
    const winningTicket = confirmedTickets.find(ticket => ticket.id === winningTicketId)
    
    if (!winningTicket) {
      return NextResponse.json(
        { error: `Winning ticket ${winningTicketId} not found in confirmed tickets for current draw` },
        { status: 404 }
      )
    }

    console.log(`Manual winner selected: Ticket ${winningTicket.id} for wallet ${winningTicket.walletAddress}`)

    // Generate draw details
    const drawId = providedDrawId || await generateDrawId()
    const drawDate = new Date().toISOString()
    
    // Create winner info - for simple format it's just one winner
    const winners: WinnerInfo[] = [{
      tier: 1,
      matchCount: 1, // Always 1 for simple random draw
      winnerCount: 1,
      prizePerWinner: config.currentJackpot.estimatedValue || 0,
      totalPrize: config.currentJackpot.estimatedValue || 0
    }]
    
    // Create the draw record with manual selection metadata
    const draw: LotteryDraw = {
      id: drawId,
      drawDate,
      jackpotAmount: config.currentJackpot,
      totalTicketsSold: confirmedTickets.length,
      winners,
      winnerWalletAddress: winningTicket.walletAddress,
      winningTicketId: winningTicket.id,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save the draw to blob storage
    await hybridStorage.saveLotteryDraw(draw)
    
    // Delete pending tickets (they never got confirmed)
    console.log(`Deleting ${pendingTickets.length} pending tickets...`)
    let deletedCount = 0
    for (const ticket of pendingTickets) {
      try {
        await hybridStorage.deleteLotteryTicket(ticket.id)
        deletedCount++
        console.log(`Deleted pending ticket ${ticket.id}`)
      } catch (error) {
        console.error(`Failed to delete pending ticket ${ticket.id}:`, error)
        // Continue with other tickets even if one fails
      }
    }
    
    // Archive confirmed and cancelled tickets for this draw
    const ticketsToArchive = [...confirmedTickets, ...cancelledTickets]
    console.log(`Archiving ${ticketsToArchive.length} tickets for completed draw ${nextDrawId}`)
    let archivedCount = 0
    for (const ticket of ticketsToArchive) {
      try {
        const archivedTicket = {
          ...ticket,
          drawStatus: 'archived' as const,
          drawResult: drawId,
          archivedAt: new Date().toISOString(),
          isWinner: ticket.id === winningTicketId // Mark the winning ticket
        }
        await hybridStorage.saveLotteryTicket(archivedTicket)
        archivedCount++
        console.log(`Archived ticket ${ticket.id}${ticket.id === winningTicketId ? ' (WINNER)' : ''}`)
      } catch (error) {
        console.error(`Failed to archive ticket ${ticket.id}:`, error)
        // Continue with other tickets even if one fails
      }
    }
    
    console.log(`Manual draw completed successfully:`, draw)
    console.log(`Manual winner: Ticket ${winningTicketId}`)
    console.log(`Tickets processed: ${allTickets.length} total`)
    console.log(`  - Deleted: ${deletedCount} pending tickets`)
    console.log(`  - Archived: ${archivedCount} confirmed/cancelled tickets`)
    
    return NextResponse.json({
      success: true,
      data: draw,
      metadata: {
        manualSelection: true,
        winningTicketId,
        winnerWallet: winningTicket.walletAddress,
        ticketsProcessed: allTickets.length,
        ticketsDeleted: deletedCount,
        ticketsArchived: archivedCount,
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