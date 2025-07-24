import { NextResponse } from 'next/server'
import { blobStorage } from '@/lib/blob-storage'

export async function GET() {
  try {
    const latestDraw = await blobStorage.getLatestLotteryDraw()
    
    if (!latestDraw) {
      return NextResponse.json(
        { error: 'No lottery results available' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: latestDraw
    })
  } catch (error) {
    console.error('GET latest lottery result error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve latest lottery result' },
      { status: 500 }
    )
  }
}