import { NextRequest, NextResponse } from 'next/server'
import { getContractRegistry } from '@/lib/contract-registry'


export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Parse query parameters outside try block for catch block access
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'all'
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined

  try {

    console.log(`📄 Fetching tokens: ${type}`)

    const registry = getContractRegistry()
    let tokens

    switch (type) {
      case 'fungible':
        tokens = await registry.getFungibleTokens()
        break
      case 'nonfungible':
        tokens = await registry.getNonFungibleTokens()
        break
      case 'all':
      default:
        {
          const [fungible, nonfungible] = await Promise.all([
            registry.getFungibleTokens(),
            registry.getNonFungibleTokens()
          ])
          tokens = [...fungible, ...nonfungible]
          break
        }
    }

    if (!tokens) {
      return NextResponse.json({
        success: false,
        error: 'No tokens found',
        type
      }, {
        status: 404,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'X-Query-Type': type
        }
      })
    }

    // Apply pagination if specified
    let paginatedTokens = tokens
    const totalCount = tokens.length

    if (offset !== undefined) {
      paginatedTokens = paginatedTokens.slice(offset)
    }

    if (limit !== undefined) {
      paginatedTokens = paginatedTokens.slice(0, limit)
    }

    const result = {
      tokens: paginatedTokens,
      pagination: {
        total: totalCount,
        limit: limit || null,
        offset: offset || null,
        hasMore: limit ? (offset || 0) + limit < totalCount : false
      }
    }

    const responseTime = Date.now() - startTime
    const response = NextResponse.json({
      success: true,
      data: result,
      meta: {
        type,
        limit,
        offset,
        responseTime,
        timestamp: Date.now()
      }
    })

    // Add Vercel cache headers - tokens don't change frequently
    response.headers.set('Cache-Control', 'public, max-age=300') // 5min browser cache
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=600') // 10min CDN cache
    response.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=1800') // 30min Vercel cache
    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('X-Query-Type', type)
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('ETag', `W/"tokens-${type}-${totalCount}-${Date.now()}"`)

    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    let errorMessage = 'Failed to fetch tokens'
    let statusCode = 500
    let statusText = 'Tokens Fetch Error'

    // Handle specific error types
    if (error instanceof Error) {
      errorMessage = error.message
      
      // Check for specific error patterns
      if (error.message.includes('Rate limit') || error.message.includes('Too Many Requests')) {
        statusCode = 429
        statusText = 'Rate Limited'
        errorMessage = 'Service temporarily rate limited. Please try again in a moment.'
      } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        statusCode = 504
        statusText = 'Gateway Timeout'
        errorMessage = 'Request timed out. Please try again.'
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        statusCode = 503
        statusText = 'Service Unavailable'
        errorMessage = 'Upstream service unavailable. Please try again.'
      }
    }

    console.error(`[Tokens API] Error (${statusCode}):`, {
      error: errorMessage,
      type,
      stack: error instanceof Error ? error.stack : 'N/A',
      responseTime
    })

    const errorResponse = {
      success: false,
      error: true,
      message: errorMessage,
      type,
      timestamp: Date.now(),
      responseTime
    }

    return NextResponse.json(errorResponse, {
      status: statusCode,
      statusText,
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Error-Type': error instanceof Error ? error.constructor.name : 'Unknown',
        'Access-Control-Allow-Origin': '*'
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