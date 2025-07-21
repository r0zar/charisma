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
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch contract'

    console.error(`Failed to fetch contract:`, error)

    const errorResponse = {
      success: false,
      error: true,
      message: errorMessage,
      timestamp: Date.now(),
      responseTime
    }

    return NextResponse.json(errorResponse, {
      status: 500,
      statusText: 'Contract Fetch Error',
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        // No cache headers for errors
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