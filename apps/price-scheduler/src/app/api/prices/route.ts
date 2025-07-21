import { NextRequest, NextResponse } from 'next/server'
import { PriceService, PriceOptions } from '@services/prices'


export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const tokens = searchParams.get('tokens')?.split(',') || []
    const currency = searchParams.get('currency') || 'usd'
    const includeHistory = searchParams.get('includeHistory') === 'true'
    const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : 7
    
    if (tokens.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'At least one token is required. Use ?tokens=token1,token2'
      }, { status: 400 })
    }

    console.log(`💰 Fetching prices for ${tokens.length} tokens`)

    // Initialize price service
    const priceService = new PriceService()
    
    const options: PriceOptions = {
      currency,
      includeHistory,
      days
    }

    const prices = await priceService.getPrices(tokens, options)

    if (!prices || Object.keys(prices).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No price data found for the requested tokens',
        tokens
      }, { 
        status: 404,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'X-Token-Count': tokens.length.toString()
        }
      })
    }

    const result = {
      prices,
      metadata: {
        requestedTokens: tokens,
        foundTokens: Object.keys(prices),
        currency,
        includeHistory,
        days: includeHistory ? days : undefined,
        requestTime: Date.now()
      }
    }

    const responseTime = Date.now() - startTime
    const response = NextResponse.json({
      success: true,
      data: result,
      meta: {
        tokens,
        currency,
        includeHistory,
        days,
        responseTime,
        timestamp: Date.now()
      }
    })

    // Add Vercel cache headers - prices change frequently
    response.headers.set('Cache-Control', 'public, max-age=60') // 1min browser cache
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=120') // 2min CDN cache  
    response.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=180') // 3min Vercel cache
    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('X-Token-Count', tokens.length.toString())
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('ETag', `W/"prices-${tokens.sort().join(',')}-${Date.now()}"`)

    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch prices'

    console.error('Failed to fetch prices:', error)

    const errorResponse = {
      success: false,
      error: true,
      message: errorMessage,
      timestamp: Date.now(),
      responseTime
    }

    return NextResponse.json(errorResponse, {
      status: 500,
      statusText: 'Prices Fetch Error',
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Cache': 'ERROR'
      }
    })
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

// Optional: Handle other HTTP methods
export async function POST() {
  return NextResponse.json({
    error: 'Method not allowed'
  }, { status: 405 })
}