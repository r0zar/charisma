import { NextRequest, NextResponse } from 'next/server'
import { BalanceSeriesAPI } from '@services/balances'

const balanceSeriesAPI = new BalanceSeriesAPI()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { addresses, contractIds, period, granularity, includeSnapshots, limit } = body

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ error: 'Addresses array is required' }, { status: 400 })
    }

    if (!contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
      return NextResponse.json({ error: 'Contract IDs array is required' }, { status: 400 })
    }

    const result = await balanceSeriesAPI.getBalanceSeries({
      addresses,
      contractIds,
      period: period || '30d',
      granularity,
      includeSnapshots,
      limit
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Balance series API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balance series' },
      { status: 500 }
    )
  }
}