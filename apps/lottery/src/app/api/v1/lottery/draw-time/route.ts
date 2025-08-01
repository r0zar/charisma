import { NextResponse } from 'next/server'
import { lotteryConfigService } from '@/lib/lottery-config'

export async function GET() {
  try {
    const nextDrawDate = await lotteryConfigService.getNextDrawTime()
    
    const response = NextResponse.json({
      success: true,
      data: {
        nextDrawDate,
        timestamp: new Date(nextDrawDate).getTime()
      }
    })
    
    // Cache for 5 minutes since draw time doesn't change frequently
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
    response.headers.set('CDN-Cache-Control', 'public, max-age=300')
    
    return response
  } catch (error) {
    console.error('GET draw time error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve next draw time' },
      { status: 500 }
    )
  }
}