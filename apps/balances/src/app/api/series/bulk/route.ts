import { NextRequest, NextResponse } from 'next/server'
import { BalanceSeriesAPI } from '@services/balances'

const balanceSeriesAPI = new BalanceSeriesAPI()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { addresses, contractIds, includeZeroBalances } = body

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ error: 'Addresses array is required' }, { status: 400 })
    }

    const result = await balanceSeriesAPI.getBulkBalances({
      addresses,
      contractIds,
      includeZeroBalances
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Bulk balance series API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bulk balance series' },
      { status: 500 }
    )
  }
}