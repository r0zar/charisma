import { NextResponse } from 'next/server'
import { lotteryConfigService } from '@/lib/lottery-config'

export async function GET() {
  try {
    const config = await lotteryConfigService.getConfig()
    
    return NextResponse.json({
      success: true,
      data: config
    })
  } catch (error) {
    console.error('GET lottery config error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve lottery configuration' },
      { status: 500 }
    )
  }
}