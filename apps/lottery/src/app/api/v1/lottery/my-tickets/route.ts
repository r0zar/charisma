import { NextRequest, NextResponse } from 'next/server'
import { ticketService } from '@/lib/ticket-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')
    const drawId = searchParams.get('drawId')
    
    console.log('My tickets API called for wallet:', walletAddress, 'drawId:', drawId)
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const tickets = await ticketService.getTicketsByWallet(walletAddress)
    console.log('Retrieved tickets from storage:', tickets.length, tickets.map(t => ({ id: t.id, status: t.status, purchaseDate: t.purchaseDate })))
    
    // Filter by draw if specified
    const filteredTickets = drawId 
      ? tickets.filter(ticket => ticket.drawId === drawId)
      : tickets
    
    console.log('Returning filtered tickets:', filteredTickets.length)
    
    const response = NextResponse.json({
      success: true,
      data: filteredTickets,
      count: filteredTickets.length
    })
    
    // Never cache my-tickets endpoint to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
    
    return response
  } catch (error) {
    console.error('GET my tickets error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve tickets' },
      { status: 500 }
    )
  }
}