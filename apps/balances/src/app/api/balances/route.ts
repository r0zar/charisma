import { NextRequest, NextResponse } from 'next/server'
import { getBalances, getBulkBalances, BulkBalancesRequest } from '@/lib/actions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const contractIds = searchParams.get('contractIds')

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const contractIdList = contractIds ? contractIds.split(',') : undefined
    const result = await getBalances(address, contractIdList)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Balances API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balances' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkBalancesRequest = await request.json()
    
    if (!body.addresses || !Array.isArray(body.addresses) || body.addresses.length === 0) {
      return NextResponse.json({ error: 'Addresses array is required' }, { status: 400 })
    }

    const result = await getBulkBalances(body)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Bulk balances API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bulk balances' },
      { status: 500 }
    )
  }
}