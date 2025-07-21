import { NextRequest, NextResponse } from 'next/server'
import { getBalance } from '@/lib/actions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const contractId = searchParams.get('contractId')

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    if (!contractId) {
      return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 })
    }

    const result = await getBalance(address, contractId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Balance API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    )
  }
}