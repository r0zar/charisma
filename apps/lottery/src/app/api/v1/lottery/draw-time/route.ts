import { NextResponse } from 'next/server'
import { lotteryConfigService } from '@/lib/lottery-config'

export async function GET() {
  try {
    const nextDrawDate = await lotteryConfigService.getNextDrawTime()

    if (!nextDrawDate) {
      return NextResponse.json({
        success: false,
        error: 'Next draw date not set'
      }, { status: 404 })
    }

    const response = NextResponse.json({
      success: true,
      data: {
        nextDrawDate,
        timestamp: new Date(nextDrawDate).getTime()
      }
    })

    // Cache for 5 seconds to allow near-instant updates from admin
    response.headers.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=5')
    response.headers.set('CDN-Cache-Control', 'public, max-age=5')

    return response
  } catch (error) {
    console.error('GET draw time error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve next draw time' },
      { status: 500 }
    )
  }
}