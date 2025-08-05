import { NextRequest, NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'
import { blobStorage } from '@/lib/blob-storage'

function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  
  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return false
  }

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting drawings reset...')

    // Get current drawing count before reset for reporting
    let drawingsDeleted = 0
    try {
      const allDraws = await hybridStorage.getAllLotteryDraws()
      drawingsDeleted = allDraws.length
      
      console.log(`Found ${drawingsDeleted} lottery draws to delete`)
      
      // Delete all lottery drawings
      for (const draw of allDraws) {
        try {
          await hybridStorage.deleteLotteryDraw(draw.id)
          console.log(`Deleted lottery draw: ${draw.id}`)
        } catch (error) {
          console.warn(`Failed to delete lottery draw ${draw.id}:`, error)
        }
      }
      
      console.log(`Successfully deleted ${drawingsDeleted} lottery draws`)
    } catch (error) {
      console.warn('Could not get drawing count before reset:', error)
    }

    // Reset draw counter in blob storage to start from 1 again
    try {
      await blobStorage.resetDrawCounter()
      console.log('Reset draw counter to 0 (next draw will be 1)')
    } catch (error) {
      console.warn('Failed to reset draw counter:', error)
    }

    console.log('Drawings reset completed successfully')

    return NextResponse.json({
      success: true,
      message: 'All lottery drawings have been reset successfully. Next draw will start from 1.',
      metadata: {
        drawingsDeleted,
        resetTimestamp: new Date().toISOString(),
        resetType: 'drawings-only',
        nextDrawNumber: 1,
        ticketsPreserved: true
      }
    })

  } catch (error) {
    console.error('Reset drawings error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to reset lottery drawings', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}