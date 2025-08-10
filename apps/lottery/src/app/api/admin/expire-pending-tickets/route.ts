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

    console.log('Starting pending ticket expiration cleanup...')
    
    const result = await ticketService.expirePendingTickets()
    
    return NextResponse.json({
      success: true,
      data: result,
      message: `Expired ${result.expired} pending tickets${result.errors > 0 ? ` (${result.errors} errors)` : ''}`
    })
  } catch (error) {
    console.error('Expire pending tickets error:', error)
    return NextResponse.json(
      { error: `Failed to expire pending tickets: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}