import { NextRequest, NextResponse } from 'next/server'
import { getContractRegistry } from '@/lib/contract-registry'

// Simple in-memory cache for individual contract results
const contractCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
const CONTRACT_CACHE_TTL = 10 * 60 * 1000 // 10 minutes (individual contracts change less frequently)
const MAX_CONTRACT_CACHE_SIZE = 200 // Cache for 200 individual contracts

function getCachedContract(contractId: string) {
  const cached = contractCache.get(contractId)
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }
  // Clean up expired entry
  if (cached) {
    contractCache.delete(contractId)
  }
  return null
}

function setCachedContract(contractId: string, data: any, customTtl?: number) {
  // Prevent cache from growing too large
  if (contractCache.size >= MAX_CONTRACT_CACHE_SIZE) {
    // Remove oldest entries (simple LRU approximation)
    const oldestKey = contractCache.keys().next().value
    if (oldestKey) contractCache.delete(oldestKey)
  }
  
  contractCache.set(contractId, {
    data,
    timestamp: Date.now(),
    ttl: customTtl || CONTRACT_CACHE_TTL
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()

  try {
    const contractId = params.id

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

    // Check cache first
    const cachedResult = getCachedContract(contractId)
    if (cachedResult) {
      console.log(`🎯 Cache hit for contract: ${contractId}`)
      const response = NextResponse.json({
        success: true,
        data: cachedResult.data,
        meta: {
          cached: true,
          contractId,
          responseTime: Date.now() - startTime,
          timestamp: cachedResult.timestamp
        }
      })
      
      // Add cache headers
      response.headers.set('X-Cache', 'HIT')
      response.headers.set('X-Cache-TTL', Math.floor((cachedResult.timestamp + CONTRACT_CACHE_TTL - Date.now()) / 1000).toString())
      response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=600') // 10 minutes
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
      response.headers.set('X-Contract-ID', contractId)
      
      return response
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
          'X-Cache': 'MISS'
        }
      })
    }

    // Cache the result
    setCachedContract(contractId, contract)
    
    console.log(`💾 Cache miss - storing new contract result: ${contractId}`)

    const responseTime = Date.now() - startTime
    const response = NextResponse.json({
      success: true,
      data: contract,
      meta: {
        cached: false,
        contractId,
        responseTime,
        timestamp: Date.now()
      }
    })

    // Add cache and performance headers
    response.headers.set('X-Cache', 'MISS')
    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=600') // 10 minutes
    response.headers.set('ETag', `W/"contract-${contractId}-${Date.now()}"`)
    response.headers.set('X-Contract-ID', contractId)

    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch contract'

    console.error(`Failed to fetch contract ${params.id}:`, error)

    const errorResponse = {
      success: false,
      error: true,
      message: errorMessage,
      contractId: params.id,
      timestamp: Date.now(),
      responseTime
    }

    return NextResponse.json(errorResponse, {
      status: 500,
      statusText: 'Contract Fetch Error',
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Cache': 'ERROR',
        'X-Contract-ID': params.id || 'unknown'
      }
    })
  }
}

// Optional: Handle other HTTP methods
export async function POST() {
  return NextResponse.json({
    error: 'Method not allowed'
  }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({
    error: 'Method not allowed'
  }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({
    error: 'Method not allowed'
  }, { status: 405 })
}