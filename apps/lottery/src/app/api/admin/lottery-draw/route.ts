import { NextRequest, NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'
import { lotteryConfigService } from '@/lib/lottery-config'
import { ticketService } from '@/lib/ticket-service'
import { LotteryDraw, DrawRequest, WinnerInfo, LotteryTicket } from '@/types/lottery'

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

function selectWinningTicket(tickets: LotteryTicket[]): LotteryTicket {
  // Randomly select one ticket to be the guaranteed winner
  const randomIndex = Math.floor(Math.random() * tickets.length)
  return tickets[randomIndex]
}

function calculateWinnersFromTicket(winningTicket: LotteryTicket, jackpotAmount: number): WinnerInfo[] {
  // Simple mode: One random ticket wins the entire jackpot
  const winners: WinnerInfo[] = [{
    tier: 1,
    matchCount: 1, // Always 1 for simple random draw
    winnerCount: 1,
    prizePerWinner: jackpotAmount,
    totalPrize: jackpotAmount
  }]

  return winners
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
    const isDryRun = requestBody.dryRun === true
    const drawRequest: DrawRequest = requestBody
    
    console.log('Draw request received:', drawRequest)
    console.log('Dry run mode:', isDryRun)

    // Get current lottery configuration
    const config = await lotteryConfigService.getConfig()
    
    // Generate draw details
    const drawId = drawRequest.drawId || generateDrawId()
    const drawDate = drawRequest.scheduledDate || new Date().toISOString()
    
    // Get all active (non-archived) tickets for the next draw
    const nextDrawId = await ticketService.getNextDrawId()
    const allTickets = await ticketService.getTicketsByDraw(nextDrawId, false) // Only get active tickets
    
    // Only process confirmed tickets for the draw (temporarily allow pending for testing)
    const tickets = allTickets.filter(ticket => ticket.status === 'confirmed' || ticket.status === 'pending')
    
    console.log(`Found ${allTickets.length} total tickets (${tickets.length} confirmed) for draw ${nextDrawId}`)
    
    if (tickets.length === 0) {
      return NextResponse.json(
        { error: 'Cannot run draw: No confirmed tickets available' },
        { status: 400 }
      )
    }

    // Simple random draw - select one random ticket as winner
    const winningTicket = selectWinningTicket(tickets)
    console.log(`Selected winning ticket ${winningTicket.id}`)

    // Get jackpot value - check if it's a PhysicalJackpot with estimatedValue
    const jackpotValue = config.currentJackpot && 'estimatedValue' in config.currentJackpot
      ? config.currentJackpot.estimatedValue || 0
      : 0

    // Calculate winners (simple mode - one winner)
    const winners = calculateWinnersFromTicket(winningTicket, jackpotValue)

    // Create the draw record
    const draw: LotteryDraw = {
      id: drawId,
      drawDate,
      jackpotAmount: config.currentJackpot || { title: 'Unknown', imageUrls: [], linkUrl: '' },
      totalTicketsSold: tickets.length,
      winners,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      winnerWalletAddress: winningTicket.walletAddress,
      winningTicketId: winningTicket.id
    }

    if (!isDryRun) {
      // Save to blob storage (only for real draws)
      await hybridStorage.saveLotteryDraw(draw)
      
      // ARCHIVE: Mark all tickets for this draw as archived (only for real draws)
      console.log(`Archiving ${tickets.length} tickets for completed draw ${nextDrawId}`)
      try {
        await hybridStorage.archiveTicketsForDraw(nextDrawId)
        console.log(`Successfully archived ${tickets.length} tickets`)
      } catch (error) {
        console.error(`Failed to archive tickets for draw ${nextDrawId}:`, error)
        // Continue even if archiving fails - the draw was still successful
      }
      
      // Update lottery config - for physical jackpots, we typically don't auto-reset
      const hasJackpotWinner = winners.some(w => w.tier === 1 && w.winnerCount > 0)
      
      // For physical jackpots, we keep the same prize unless manually updated
      // The estimated value can stay the same or be updated by admin
      if (hasJackpotWinner) {
        console.log(`Physical jackpot "${config.currentJackpot?.title || 'Unknown'}" has been won!`)
        // Note: Admin should manually set a new physical jackpot for the next draw
      }
    } else {
      console.log('DRY RUN: Skipping data persistence and ticket archiving')
    }

    const hasJackpotWinner = winners.some(w => w.tier === 1 && w.winnerCount > 0)
    
    console.log(`${isDryRun ? 'DRY RUN' : 'Draw'} completed successfully:`, draw)
    console.log(`Jackpot winner: ${hasJackpotWinner ? 'YES' : 'NO'}`)
    console.log(`Tickets ${isDryRun ? 'processed' : 'archived'}: ${tickets.length}`)
    
    return NextResponse.json({
      success: true,
      data: draw,
      metadata: {
        isDryRun,
        ticketsProcessed: tickets.length,
        ticketsArchived: isDryRun ? 0 : tickets.length,
        drawType: 'simple-random',
        jackpotWinner: hasJackpotWinner,
        currentJackpot: config.currentJackpot?.title || 'Unknown'
      }
    })
  } catch (error) {
    console.error('Admin POST lottery draw error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: `Failed to run lottery draw: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}