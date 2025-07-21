import { NextRequest, NextResponse } from 'next/server'
import { BalanceService } from '@services/balances'

const balanceService = new BalanceService()

export async function DELETE(request: NextRequest) {
  try {
    balanceService.clearCache()
    
    return NextResponse.json({ 
      message: 'Cache cleared successfully',
      success: true 
    })
  } catch (error) {
    console.error('Clear cache API error:', error)
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}