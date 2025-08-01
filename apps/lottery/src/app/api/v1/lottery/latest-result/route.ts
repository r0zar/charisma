import { NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'

export async function GET() {
  try {
    const latestDraw = await hybridStorage.getLatestLotteryDraw()
    
    if (!latestDraw) {
      return NextResponse.json(
        { error: 'No lottery results available' },
        { status: 404 }
      )
    }
    
    const response = NextResponse.json({
      success: true,
      data: latestDraw
    })
    
    // Cache latest result for 2 minutes since it updates infrequently
    response.headers.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=60')
    response.headers.set('CDN-Cache-Control', 'public, max-age=120')
    
    return response
  } catch (error) {
    console.error('GET latest lottery result error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve latest lottery result' },
      { status: 500 }
    )
  }
}