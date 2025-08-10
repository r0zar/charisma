import { NextRequest, NextResponse } from 'next/server'
import { ticketService } from '@/lib/ticket-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')
    const limit = parseInt(searchParams.get('limit') || '3')
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Use the same service as main my-tickets endpoint for consistency
    const tickets = await ticketService.getTicketsByWallet(walletAddress)
    
    // Filter to only active tickets
    const activeTickets = tickets
      .filter(ticket => !ticket.drawStatus || ticket.drawStatus === 'active')
    
    // Get the total count before limiting results
    const totalCount = activeTickets.length
    
    // Limit results for display
    const limitedTickets = activeTickets.slice(0, limit)
    
    const response = NextResponse.json({
      success: true,
      data: limitedTickets,
      count: totalCount
    })
    
    // Cache for 2 seconds to improve performance while still being responsive for real-time updates
    response.headers.set('Cache-Control', 'public, max-age=2, stale-while-revalidate=10')
    
    return response
  } catch (error) {
    console.error('GET my tickets preview error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve tickets preview' },
      { status: 500 }
    )
  }
}