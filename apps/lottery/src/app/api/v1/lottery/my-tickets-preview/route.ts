import { NextRequest, NextResponse } from 'next/server'
import { kvTicketStorage } from '@/lib/kv-ticket-storage'

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

    // Only get from KV for speed - active tickets should be in KV
    const tickets = await kvTicketStorage.getTicketsByWallet(walletAddress)
    
    // Filter to only active tickets and limit results
    const activeTickets = tickets
      .filter(ticket => ticket.status === 'pending' || ticket.status === 'confirmed')
      .slice(0, limit)
    
    const response = NextResponse.json({
      success: true,
      data: activeTickets,
      count: activeTickets.length
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