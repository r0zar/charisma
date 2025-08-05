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

    const { drawId } = await request.json()
    
    if (!drawId) {
      return NextResponse.json(
        { error: 'Draw ID is required' },
        { status: 400 }
      )
    }

    console.log('Starting undo process for draw:', drawId)

    // 1. Get the draw to verify it exists
    const draw = await hybridStorage.getLotteryDraw(drawId)
    
    if (!draw) {
      return NextResponse.json(
        { error: 'Draw not found' },
        { status: 404 }
      )
    }

    if (draw.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only undo completed draws' },
        { status: 400 }
      )
    }

    console.log('Found draw to undo:', draw.id, 'Date:', draw.drawDate)

    // 2. Get all archived tickets that were part of this draw
    // We need to find tickets that have drawResult matching this drawId or were archived around the draw time
    const allArchivedTickets = await hybridStorage.getAllLotteryTickets()
    const drawTickets = allArchivedTickets.filter(ticket => 
      ticket.status === 'archived' && 
      (ticket.drawResult === drawId || 
       // Fallback: check if ticket was archived around the same time as the draw
       (!ticket.drawResult && Math.abs(new Date(ticket.purchaseDate).getTime() - new Date(draw.drawDate).getTime()) < 24 * 60 * 60 * 1000))
    )

    console.log(`Found ${drawTickets.length} archived tickets to restore for draw ${drawId}`)

    if (drawTickets.length === 0) {
      console.log('No tickets found to restore, continuing with draw deletion only')
    }

    // 3. Restore tickets to their original status (remove archived status and drawResult)
    let restoredCount = 0
    for (const ticket of drawTickets) {
      try {
        // Determine the original status - default to 'confirmed' for restored tickets
        const originalStatus = ticket.status === 'archived' ? 'confirmed' : ticket.status
        
        const restoredTicket: LotteryTicket = {
          ...ticket,
          status: originalStatus,
          drawResult: undefined // Remove the draw result reference
        }
        
        // Save the restored ticket (will go to KV storage since it's now active)
        await hybridStorage.saveLotteryTicket(restoredTicket)
        restoredCount++
        
        console.log(`Restored ticket ${ticket.id} to status: ${originalStatus}`)
      } catch (error) {
        console.error(`Failed to restore ticket ${ticket.id}:`, error)
        // Continue with other tickets even if one fails
      }
    }

    // 4. Delete the lottery draw record
    await hybridStorage.deleteLotteryDraw(drawId)
    console.log(`Deleted lottery draw ${drawId}`)

    console.log(`Successfully undid lottery draw ${drawId}:`)
    console.log(`- Restored ${restoredCount} tickets to active status`)
    console.log(`- Deleted draw record`)

    return NextResponse.json({
      success: true,
      message: `Successfully undid lottery draw ${drawId}`,
      metadata: {
        drawId,
        drawDate: draw.drawDate,
        ticketsRestored: restoredCount,
        totalTicketsFound: drawTickets.length,
        winnerWallet: draw.winnerWalletAddress,
        winningTicketId: draw.winningTicketId,
        undoTimestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Undo lottery draw error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to undo lottery draw', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}