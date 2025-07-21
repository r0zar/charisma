import { NextRequest, NextResponse } from 'next/server'
import { BalanceService } from '@services/balances'

const balanceService = new BalanceService()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const balances = await balanceService.getAllBalances(address)
    
    return NextResponse.json({ 
      address, 
      balances,
      count: balances.length,
      success: true 
    })
  } catch (error) {
    console.error('All balances API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch all balances' },
      { status: 500 }
    )
  }
}