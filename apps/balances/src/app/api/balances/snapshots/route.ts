import { NextRequest, NextResponse } from 'next/server'
import { BalanceService } from '@services/balances'

const balanceService = new BalanceService()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const period = searchParams.get('period') as '1d' | '7d' | '30d' | '1y' | 'all' || '30d'

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const snapshots = await balanceService.getBalanceSnapshots(address, period)
    
    return NextResponse.json({ 
      address, 
      period,
      snapshots,
      count: snapshots.length,
      success: true 
    })
  } catch (error) {
    console.error('Balance snapshots API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balance snapshots' },
      { status: 500 }
    )
  }
}