import { NextResponse } from 'next/server'
import { lotteryConfigService } from '@/lib/lottery-config'

export async function GET() {
  try {
    const jackpot = await lotteryConfigService.getCurrentJackpot()
    
    return NextResponse.json({
      success: true,
      data: {
        jackpot
      }
    })
  } catch (error) {
    console.error('GET jackpot error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve current jackpot' },
      { status: 500 }
    )
  }
}