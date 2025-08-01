import { NextRequest, NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'
import { LotteryDraw } from '@/types/lottery'

function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  
  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return false
  }

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
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
      
      return NextResponse.json({
        success: true,
        data: draw
      })
    } else {
      // Get all draws
      const draws = await hybridStorage.getAllLotteryDraws()
      
      return NextResponse.json({
        success: true,
        data: draws,
        count: draws.length
      })
    }
  } catch (error) {
    console.error('Admin GET lottery results error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const drawId = searchParams.get('drawId')
    
    if (!drawId) {
      return NextResponse.json(
        { error: 'Draw ID is required' },
        { status: 400 }
      )
    }

    const updates = await request.json()
    console.log('PUT request received for draw:', drawId, 'updates:', updates)
    
    // Get existing draw
    const existingDraw = await hybridStorage.getLotteryDraw(drawId)
    
    if (!existingDraw) {
      return NextResponse.json(
        { error: 'Draw not found' },
        { status: 404 }
      )
    }

    // Update the draw
    const updatedDraw: LotteryDraw = {
      ...existingDraw,
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    // Validate required fields
    if (!updatedDraw.id || !updatedDraw.drawDate) {
      return NextResponse.json(
        { error: 'Missing required draw fields' },
        { status: 400 }
      )
    }

    await hybridStorage.saveLotteryDraw(updatedDraw)
    console.log('Draw updated successfully:', updatedDraw)
    
    return NextResponse.json({
      success: true,
      data: updatedDraw
    })
  } catch (error) {
    console.error('Admin PUT lottery results error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const drawId = searchParams.get('drawId')
    
    if (!drawId) {
      return NextResponse.json(
        { error: 'Draw ID is required' },
        { status: 400 }
      )
    }

    // Check if draw exists
    const existingDraw = await hybridStorage.getLotteryDraw(drawId)
    
    if (!existingDraw) {
      return NextResponse.json(
        { error: 'Draw not found' },
        { status: 404 }
      )
    }

    await hybridStorage.deleteLotteryDraw(drawId)
    console.log('Draw deleted successfully:', drawId)
    
    return NextResponse.json({
      success: true,
      message: `Draw ${drawId} deleted successfully`
    })
  } catch (error) {
    console.error('Admin DELETE lottery results error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}