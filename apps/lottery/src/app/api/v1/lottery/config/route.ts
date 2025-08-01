import { NextResponse } from 'next/server'
import { lotteryConfigService } from '@/lib/lottery-config'

export async function GET() {
  try {
    const config = await lotteryConfigService.getConfig()
    
    const response = NextResponse.json({
      success: true,
      data: config
    })
    
    // Cache for 5 minutes since config doesn't change frequently
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
    response.headers.set('CDN-Cache-Control', 'public, max-age=300')
    
    return response
  } catch (error) {
    console.error('GET lottery config error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve lottery configuration' },
      { status: 500 }
    )
  }
}