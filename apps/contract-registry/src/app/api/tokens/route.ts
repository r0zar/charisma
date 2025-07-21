import { NextRequest, NextResponse } from 'next/server'
import { getContractRegistry } from '@/lib/contract-registry'

// Simple in-memory cache for token data
const tokenCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
const TOKEN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes (tokens data doesn't change frequently)
const MAX_TOKEN_CACHE_SIZE = 50 // Cache for 50 different token queries

function getCachedTokens(cacheKey: string) {
  const cached = tokenCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }
  // Clean up expired entry
  if (cached) {
    tokenCache.delete(cacheKey)
  }
  return null
}

function setCachedTokens(cacheKey: string, data: any, customTtl?: number) {
  // Prevent cache from growing too large
  if (tokenCache.size >= MAX_TOKEN_CACHE_SIZE) {
    // Remove oldest entries (simple LRU approximation)
    const oldestKey = tokenCache.keys().next().value
    if (oldestKey) tokenCache.delete(oldestKey)
  }
  
  tokenCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl: customTtl || TOKEN_CACHE_TTL
  })
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined

    // Create cache key based on query parameters
    const cacheKey = `tokens:${type}:${limit || 'none'}:${offset || 'none'}`

    // Check cache first
    const cachedResult = getCachedTokens(cacheKey)
    if (cachedResult) {
      console.log(`🎯 Cache hit for tokens: ${cacheKey}`)
      const response = NextResponse.json({
        success: true,
        data: cachedResult.data,
        meta: {
          cached: true,
          type,
          limit,
          offset,
          responseTime: Date.now() - startTime,
          timestamp: cachedResult.timestamp
        }
      })
      
      // Add cache headers
      response.headers.set('X-Cache', 'HIT')
      response.headers.set('X-Cache-TTL', Math.floor((cachedResult.timestamp + TOKEN_CACHE_TTL - Date.now()) / 1000).toString())
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300') // 5 minutes
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
      response.headers.set('X-Query-Type', type)
      
      return response
    }

    console.log(`📄 Fetching tokens: ${cacheKey}`)

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
        const [fungible, nonfungible] = await Promise.all([
          registry.getFungibleTokens(),
          registry.getNonFungibleTokens()
        ])
        tokens = [...fungible, ...nonfungible]
        break
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
          'X-Query-Type': type,
          'X-Cache': 'MISS'
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

    // Cache the result
    setCachedTokens(cacheKey, result)
    
    console.log(`💾 Cache miss - storing new tokens result: ${cacheKey}`)

    const responseTime = Date.now() - startTime
    const response = NextResponse.json({
      success: true,
      data: result,
      meta: {
        cached: false,
        type,
        limit,
        offset,
        responseTime,
        timestamp: Date.now()
      }
    })

    // Add cache and performance headers
    response.headers.set('X-Cache', 'MISS')
    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300') // 5 minutes
    response.headers.set('ETag', `W/"tokens-${type}-${Date.now()}"`)
    response.headers.set('X-Query-Type', type)

    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tokens'

    console.error('Failed to fetch tokens:', error)

    const errorResponse = {
      success: false,
      error: true,
      message: errorMessage,
      timestamp: Date.now(),
      responseTime
    }

    return NextResponse.json(errorResponse, {
      status: 500,
      statusText: 'Tokens Fetch Error',
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Cache': 'ERROR'
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