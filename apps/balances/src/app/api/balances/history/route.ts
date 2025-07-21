import { NextRequest, NextResponse } from 'next/server'
import { BalanceService } from '@services/balances'

const balanceService = new BalanceService()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const contractId = searchParams.get('contractId')
    const period = searchParams.get('period') as '1d' | '7d' | '30d' | '1y' | 'all' || '30d'

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    if (!contractId) {
      return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 })
    }

    const history = await balanceService.getBalanceHistory(address, contractId, period)
    
    return NextResponse.json({ 
      address, 
      contractId,
      period,
      history,
      count: history.length,
      success: true 
    })
  } catch (error) {
    console.error('Balance history API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balance history' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { addresses, contractIds, period = '30d' } = body

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ error: 'Addresses array is required' }, { status: 400 })
    }

    if (!contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
      return NextResponse.json({ error: 'Contract IDs array is required' }, { status: 400 })
    }

    const history = await balanceService.getBulkBalanceHistory(addresses, contractIds, period)
    
    return NextResponse.json({ 
      addresses, 
      contractIds,
      period,
      history,
      success: true 
    })
  } catch (error) {
    console.error('Bulk balance history API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bulk balance history' },
      { status: 500 }
    )
  }
}