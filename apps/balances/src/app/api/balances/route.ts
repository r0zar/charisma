import { NextRequest, NextResponse } from 'next/server'
import { getBalances, getBulkBalances, BulkBalancesRequest } from '@/lib/actions'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const contractIds = searchParams.get('contractIds')

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const contractIdList = contractIds ? contractIds.split(',') : undefined
    const result = await getBalances(address, contractIdList)
    
    const responseTime = Date.now() - startTime
    const response = NextResponse.json({
      success: true,
      data: result,
      meta: {
        address,
        contractIds: contractIdList,
        responseTime,
        timestamp: Date.now()
      }
    })

    // Add Vercel cache headers - balances change frequently so short cache
    response.headers.set('Cache-Control', 'public, max-age=30') // 30s browser cache
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=60') // 1min CDN cache
    response.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=120') // 2min Vercel cache
    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    
    return response
  } catch (error) {
    console.error('Balances API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balances' },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      }
    )
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body: BulkBalancesRequest = await request.json()
    
    if (!body.addresses || !Array.isArray(body.addresses) || body.addresses.length === 0) {
      return NextResponse.json({ error: 'Addresses array is required' }, { status: 400 })
    }

    const result = await getBulkBalances(body)
    
    const responseTime = Date.now() - startTime
    const response = NextResponse.json({
      success: true,
      data: result,
      meta: {
        addressCount: body.addresses.length,
        contractIds: body.contractIds,
        responseTime,
        timestamp: Date.now()
      }
    })

    // Add Vercel cache headers - bulk balances can be cached slightly longer
    response.headers.set('Cache-Control', 'public, max-age=60') // 1min browser cache
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=120') // 2min CDN cache
    response.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=300') // 5min Vercel cache
    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    
    return response
  } catch (error) {
    console.error('Bulk balances API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bulk balances' },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      }
    )
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}