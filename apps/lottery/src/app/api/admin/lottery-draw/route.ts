import { NextRequest, NextResponse } from 'next/server'
import { blobStorage } from '@/lib/blob-storage'
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

function generateWinningNumbers(maxNumber: number, count: number): number[] {
  const numbers: number[] = []
  while (numbers.length < count) {
    const num = Math.floor(Math.random() * maxNumber) + 1
    if (!numbers.includes(num)) {
      numbers.push(num)
    }
  }
  return numbers.sort((a, b) => a - b)
}

function selectWinningTicket(tickets: LotteryTicket[]): LotteryTicket {
  // Randomly select one ticket to be the guaranteed winner
  const randomIndex = Math.floor(Math.random() * tickets.length)
  return tickets[randomIndex]
}

function countMatches(ticketNumbers: number[], winningNumbers: number[]): number {
  return ticketNumbers.filter(num => winningNumbers.includes(num)).length
}

function calculateWinnersFromTickets(tickets: LotteryTicket[], winningNumbers: number[], jackpotAmount: number): WinnerInfo[] {
  // WINNER TAKES ALL: Only the ticket with the winning numbers gets the entire jackpot
  
  // Find the exact match (guaranteed since we selected winning numbers from a ticket)
  const jackpotWinners = tickets.filter(ticket => 
    countMatches(ticket.numbers, winningNumbers) === 6
  )

  if (jackpotWinners.length === 0) {
    // This should never happen with our guaranteed winner system, but just in case
    throw new Error('No jackpot winner found - this should not happen with guaranteed winner system')
  }

  // Winner takes all - entire jackpot goes to the winner(s)
  const winners: WinnerInfo[] = [{
    tier: 1,
    matchCount: 6,
    winnerCount: jackpotWinners.length,
    prizePerWinner: Math.floor(jackpotAmount / jackpotWinners.length), // Split jackpot if multiple exact matches
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

    let winningNumbers: number[]
    
    if (drawRequest.winningNumbers) {
      // Use provided winning numbers (for testing)
      winningNumbers = drawRequest.winningNumbers
    } else {
      // GUARANTEED WINNER LOGIC: Select a random ticket and use its numbers as winning numbers
      const winningTicket = selectWinningTicket(tickets)
      winningNumbers = [...winningTicket.numbers]
      console.log(`Selected winning ticket ${winningTicket.id} with numbers:`, winningNumbers)
    }
    
    // Calculate actual winners based on ticket matches
    const winners = calculateWinnersFromTickets(tickets, winningNumbers, config.currentJackpot.estimatedValue || 0)
    
    // Create the draw record
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

    if (!isDryRun) {
      // Save to blob storage (only for real draws)
      await blobStorage.saveLotteryDraw(draw)
      
      // ARCHIVE: Mark all tickets for this draw as archived (only for real draws)
      console.log(`Archiving ${tickets.length} tickets for completed draw ${nextDrawId}`)
      for (const ticket of tickets) {
        try {
          const archivedTicket = {
            ...ticket,
            status: 'archived' as const,
            drawResult: drawId // Link to the completed draw
          }
          await blobStorage.saveLotteryTicket(archivedTicket)
          console.log(`Archived ticket ${ticket.id}`)
        } catch (error) {
          console.error(`Failed to archive ticket ${ticket.id}:`, error)
          // Continue with other tickets even if one fails
        }
      }
      
      // Update lottery config - for physical jackpots, we typically don't auto-reset
      const hasJackpotWinner = winners.some(w => w.tier === 1 && w.winnerCount > 0)
      
      // For physical jackpots, we keep the same prize unless manually updated
      // The estimated value can stay the same or be updated by admin
      if (hasJackpotWinner) {
        console.log(`Physical jackpot "${config.currentJackpot.title}" has been won!`)
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
        guaranteedWinner: !drawRequest.winningNumbers,
        jackpotWinner: hasJackpotWinner,
        currentJackpot: config.currentJackpot.title
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