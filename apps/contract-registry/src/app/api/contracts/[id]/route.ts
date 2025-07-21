import { NextRequest, NextResponse } from 'next/server'
import { getContractRegistry } from '@/lib/contract-registry'

// Optimized cache headers for individual contracts (stable data)
const CACHE_HEADERS = {
  // 1hr browser, 6hr CDN, 24hr Vercel CDN (individual contracts rarely change)
  'Cache-Control': 'public, max-age=3600',
  'CDN-Cache-Control': 'public, s-maxage=21600',
  'Vercel-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    const { id } = await params
    const contractId = id

    if (!contractId) {
      return NextResponse.json({
        success: false,
        error: 'Contract ID is required'
      }, { status: 400 })
    }

    // Validate contract ID format (basic validation)
    if (!contractId.includes('.') || contractId.length < 3) {
      return NextResponse.json({
        success: false,
        error: 'Invalid contract ID format'
      }, { status: 400 })
    }

    console.log(`📄 Fetching contract: ${contractId}`)

    const registry = getContractRegistry()
    const contract = await registry.getContract(contractId)

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found',
        contractId
      }, { 
        status: 404,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'X-Contract-ID': contractId,
          // No cache headers for 404s
        }
      })
    }

    const responseTime = Date.now() - startTime
    const response = NextResponse.json({
      success: true,
      data: contract,
      meta: {
        contractId,
        responseTime,
        timestamp: Date.now()
      }
    })

    // Add optimized Vercel cache headers and performance metadata
    Object.entries(CACHE_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('X-Contract-ID', contractId)
    response.headers.set('ETag', `W/"contract-${contractId}-${contract.lastUpdated || Date.now()}"`)

    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    let errorMessage = 'Failed to fetch contract'
    let statusCode = 500
    let statusText = 'Contract Fetch Error'

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

    console.error(`[Contract API] Error (${statusCode}):`, {
      error: errorMessage,
      contractId: request.url.split('/').pop(),
      stack: error instanceof Error ? error.stack : 'N/A',
      responseTime
    })

    const errorResponse = {
      success: false,
      error: true,
      message: errorMessage,
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
    headers: CACHE_HEADERS
  })
}