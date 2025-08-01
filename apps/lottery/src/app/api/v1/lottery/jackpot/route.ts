import { NextResponse } from 'next/server'
import { lotteryConfigService } from '@/lib/lottery-config'

export async function GET() {
  try {
    const jackpot = await lotteryConfigService.getCurrentJackpot()
    
    const response = NextResponse.json({
      success: true,
      data: {
        jackpot
      }
    })
    
    // Cache for 5 minutes since jackpot doesn't change frequently
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
    response.headers.set('CDN-Cache-Control', 'public, max-age=300')
    
    return response
  } catch (error) {
    console.error('GET jackpot error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve current jackpot' },
      { status: 500 }
    )
  }
}