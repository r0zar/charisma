import { NextRequest, NextResponse } from 'next/server'
import { KVBalanceStore } from '@services/balances'

export async function GET(request: NextRequest) {
  try {
    const balanceStore = new KVBalanceStore()
    
    // Get current balance stats
    const stats = await balanceStore.getStats()
    
    return NextResponse.json({
      success: true,
      stats,
      message: 'Balance statistics retrieved successfully'
    })
  } catch (error) {
    console.error('Failed to get balance statistics:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve balance statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}