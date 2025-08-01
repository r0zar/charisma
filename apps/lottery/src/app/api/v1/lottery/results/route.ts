import { NextRequest, NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const drawId = searchParams.get('drawId')
    
    if (drawId) {
      // Get specific draw
      const draw = await hybridStorage.getLotteryDraw(drawId)
      
      if (!draw) {
        return NextResponse.json(
          { error: 'Draw not found' },
          { status: 404 }
        )
      }
      
      const response = NextResponse.json({
        success: true,
        data: draw
      })
      
      // Cache specific draw results for 1 hour since they don't change
      response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300')
      response.headers.set('CDN-Cache-Control', 'public, max-age=3600')
      
      return response
    } else {
      // Get recent draws with limit
      const allDraws = await hybridStorage.getAllLotteryDraws()
      const draws = allDraws.slice(0, Math.min(limit, 50)) // Max 50 results
      
      const response = NextResponse.json({
        success: true,
        data: draws,
        count: draws.length,
        total: allDraws.length
      })
      
      // Cache results list for 2 minutes since new draws can be created
      response.headers.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=60')
      response.headers.set('CDN-Cache-Control', 'public, max-age=120')
      
      return response
    }
  } catch (error) {
    console.error('GET lottery results error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve lottery results' },
      { status: 500 }
    )
  }
}