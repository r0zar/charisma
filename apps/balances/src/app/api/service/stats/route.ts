import { NextRequest, NextResponse } from 'next/server'
import { getServiceStats } from '@/lib/actions'

export async function GET(_request: NextRequest) {
  try {
    const stats = await getServiceStats()
    
    return NextResponse.json({ 
      stats,
      success: true 
    })
  } catch (error) {
    console.error('Service stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to get service stats' },
      { status: 500 }
    )
  }
}