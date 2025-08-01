import { NextRequest, NextResponse } from 'next/server'
import { ticketService } from '@/lib/ticket-service'
import { hybridStorage } from '@/lib/hybrid-storage'

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, ticketIds } = await request.json()
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // If no specific ticket IDs provided, cancel all pending tickets for the wallet
    let ticketsToCancel = []
    
    if (ticketIds && Array.isArray(ticketIds) && ticketIds.length > 0) {
      // Cancel specific tickets
      for (const ticketId of ticketIds) {
        const ticket = await ticketService.getTicket(ticketId)
        if (ticket && ticket.walletAddress === walletAddress && ticket.status === 'pending') {
          ticketsToCancel.push(ticket)
        }
      }
    } else {
      // Cancel all pending tickets for wallet
      const allTickets = await ticketService.getTicketsByWallet(walletAddress)
      ticketsToCancel = allTickets.filter(ticket => ticket.status === 'pending')
    }

    if (ticketsToCancel.length === 0) {
      return NextResponse.json(
        { error: 'No pending tickets found to cancel' },
        { status: 404 }
      )
    }

    // Update tickets to cancelled status
    const cancelledTickets = []
    for (const ticket of ticketsToCancel) {
      const cancelledTicket = {
        ...ticket,
        status: 'cancelled' as const,
        cancelledAt: new Date().toISOString()
      }
      
      await hybridStorage.saveLotteryTicket(cancelledTicket)
      cancelledTickets.push(cancelledTicket)
    }

    console.log(`Cancelled ${cancelledTickets.length} tickets for wallet ${walletAddress}`)
    
    return NextResponse.json({
      success: true,
      data: cancelledTickets,
      message: `Successfully cancelled ${cancelledTickets.length} pending ticket${cancelledTickets.length !== 1 ? 's' : ''}`
    })
  } catch (error) {
    console.error('Cancel tickets error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel tickets' },
      { status: 500 }
    )
  }
}