import { NextRequest, NextResponse } from 'next/server'
import { blobStorage } from '@/lib/blob-storage'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const drawId = searchParams.get('drawId')
    
    if (drawId) {
      // Get specific draw
      const draw = await blobStorage.getLotteryDraw(drawId)
      
      if (!draw) {
        return NextResponse.json(
          { error: 'Draw not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        data: draw
      })
    } else {
      // Get recent draws with limit
      const allDraws = await blobStorage.getAllLotteryDraws()
      const draws = allDraws.slice(0, Math.min(limit, 50)) // Max 50 results
      
      return NextResponse.json({
        success: true,
        data: draws,
        count: draws.length,
        total: allDraws.length
      })
    }
  } catch (error) {
    console.error('GET lottery results error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve lottery results' },
      { status: 500 }
    )
  }
}