import { NextRequest, NextResponse } from 'next/server'
import { ticketService } from '@/lib/ticket-service'
import { TicketPurchaseRequest, getLotteryFormat } from '@/types/lottery'

export async function POST(request: NextRequest) {
  try {
    const purchaseRequest: TicketPurchaseRequest = await request.json()
    console.log('Ticket purchase request received:', purchaseRequest)

    // Basic validation
    if (!purchaseRequest.walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    if (!purchaseRequest.numbers || !Array.isArray(purchaseRequest.numbers)) {
      return NextResponse.json(
        { error: 'Numbers array is required' },
        { status: 400 }
      )
    }

    // Format-specific validation
    const lotteryFormat = getLotteryFormat()
    if (lotteryFormat === 'simple' && purchaseRequest.numbers.length > 0) {
      console.warn('Simple format ticket purchase included numbers, ignoring them')
      purchaseRequest.numbers = [] // Clear numbers for simple format
    }

    // Purchase the ticket
    const ticket = await ticketService.purchaseTicket(purchaseRequest)
    
    return NextResponse.json({
      success: true,
      data: ticket
    })
  } catch (error) {
    console.error('POST purchase ticket error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to purchase ticket' },
      { status: 400 }
    )
  }
}