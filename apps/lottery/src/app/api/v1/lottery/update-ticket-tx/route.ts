import { NextRequest, NextResponse } from 'next/server'
import { ticketService } from '@/lib/ticket-service'

export interface UpdateTicketTransactionRequest {
  ticketId: string
  transactionId: string
  walletAddress: string
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateTicketTransactionRequest = await request.json()
    const { ticketId, transactionId, walletAddress } = body
    
    console.log('Update ticket transaction request:', { ticketId, transactionId, walletAddress })
    
    // Validate input
    if (!ticketId || !transactionId || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Get the ticket to verify ownership
    const ticket = await ticketService.getTicket(ticketId)
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      )
    }
    
    if (ticket.walletAddress !== walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address mismatch' },
        { status: 400 }
      )
    }
    
    if (ticket.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Ticket is not pending, current status: ${ticket.status}` },
        { status: 400 }
      )
    }
    
    // Update the ticket with transaction ID
    const updatedTicket = await ticketService.updateTicketTransactionId(ticketId, transactionId)
    
    console.log(`Ticket ${ticketId} updated with transaction ID successfully`)
    
    const response = NextResponse.json({
      success: true,
      data: {
        ticketId,
        transactionId,
        status: updatedTicket.status
      }
    })
    
    // Never cache this endpoint to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
    
    return response
    
  } catch (error) {
    console.error('Update ticket transaction API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
    
    const response = NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 })
    
    // Never cache error responses
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
    
    return response
  }
}