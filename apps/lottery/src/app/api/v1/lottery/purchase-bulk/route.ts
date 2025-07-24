import { NextRequest, NextResponse } from 'next/server'
import { ticketService } from '@/lib/ticket-service'
import { BulkTicketPurchaseRequest } from '@/types/lottery'

export async function POST(request: NextRequest) {
  try {
    const purchaseRequest: BulkTicketPurchaseRequest = await request.json()
    console.log('Bulk ticket purchase request received:', purchaseRequest)

    // Basic validation
    if (!purchaseRequest.walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    if (!purchaseRequest.quantity || purchaseRequest.quantity < 1) {
      return NextResponse.json(
        { error: 'Quantity must be at least 1' },
        { status: 400 }
      )
    }

    // Purchase the tickets
    const tickets = await ticketService.purchaseBulkTickets(purchaseRequest)
    
    return NextResponse.json({
      success: true,
      data: tickets,
      count: tickets.length,
      totalCost: tickets.reduce((sum, ticket) => sum + ticket.purchasePrice, 0)
    })
  } catch (error) {
    console.error('POST purchase bulk tickets error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to purchase bulk tickets' },
      { status: 400 }
    )
  }
}