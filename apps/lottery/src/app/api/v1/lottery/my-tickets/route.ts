import { NextRequest, NextResponse } from 'next/server'
import { ticketService } from '@/lib/ticket-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')
    const drawId = searchParams.get('drawId')
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const tickets = await ticketService.getTicketsByWallet(walletAddress)
    
    // Filter by draw if specified
    const filteredTickets = drawId 
      ? tickets.filter(ticket => ticket.drawId === drawId)
      : tickets
    
    return NextResponse.json({
      success: true,
      data: filteredTickets,
      count: filteredTickets.length
    })
  } catch (error) {
    console.error('GET my tickets error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve tickets' },
      { status: 500 }
    )
  }
}