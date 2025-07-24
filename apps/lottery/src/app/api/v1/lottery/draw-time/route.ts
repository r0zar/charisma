import { NextResponse } from 'next/server'
import { lotteryConfigService } from '@/lib/lottery-config'

export async function GET() {
  try {
    const nextDrawDate = await lotteryConfigService.getNextDrawTime()
    
    return NextResponse.json({
      success: true,
      data: {
        nextDrawDate,
        timestamp: new Date(nextDrawDate).getTime()
      }
    })
  } catch (error) {
    console.error('GET draw time error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve next draw time' },
      { status: 500 }
    )
  }
}