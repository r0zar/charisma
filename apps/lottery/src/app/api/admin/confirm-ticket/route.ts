import { NextRequest, NextResponse } from 'next/server'
import { ticketService } from '@/lib/ticket-service'

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

    const { ticketId, transactionId } = await request.json()
    console.log('Ticket confirmation request:', { ticketId, transactionId })

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      )
    }

    const confirmedTicket = await ticketService.confirmTicket(ticketId, transactionId)
    
    return NextResponse.json({
      success: true,
      data: confirmedTicket
    })
  } catch (error) {
    console.error('Admin POST confirm ticket error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm ticket' },
      { status: 400 }
    )
  }
}