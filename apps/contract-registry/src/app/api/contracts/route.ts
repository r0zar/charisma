import { NextRequest, NextResponse } from 'next/server'
import { getContractRegistry } from '@/lib/contract-registry'

// Simple in-memory cache for contract results
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 100 // Limit cache size to prevent memory issues

function getCacheKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams)
  // Normalize parameters for consistent caching
  params.sort()
  return params.toString()
}

function getCachedResult(cacheKey: string) {
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }
  // Clean up expired entry
  if (cached) {
    cache.delete(cacheKey)
  }
  return null
}

function setCachedResult(cacheKey: string, data: any, customTtl?: number) {
  // Prevent cache from growing too large
  if (cache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entries (simple LRU approximation)
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  
  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl: customTtl || CACHE_TTL
  })
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const cacheKey = getCacheKey(searchParams)

    // Check cache first
    const cachedResult = getCachedResult(cacheKey)
    if (cachedResult) {
      console.log('🎯 Cache hit for contracts request')
      const response = NextResponse.json(cachedResult.data)
      
      // Add cache headers
      response.headers.set('X-Cache', 'HIT')
      response.headers.set('X-Cache-TTL', Math.floor((cachedResult.timestamp + cachedResult.ttl - Date.now()) / 1000).toString())
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300') // 5 minutes
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
      
      return response
    }

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const contractType = searchParams.get('type')
    const trait = searchParams.get('trait')
    const status = searchParams.get('status')

    const registry = getContractRegistry()

    // Check if any filters are actually applied
    const hasFilters = (contractType && contractType !== 'all') ||
      (trait && trait !== 'all') ||
      (status && status !== 'all')

    let result

    if (hasFilters) {
      // Build search query with filters
      const query: any = {
        offset,
        limit
      }

      if (contractType && contractType !== 'all') {
        query.contractType = contractType
      }

      if (trait && trait !== 'all') {
        query.implementedTraits = [trait]
      }

      if (status && status !== 'all') {
        query.validationStatus = status
      }

      console.log('Filtered search query:', JSON.stringify(query, null, 2))
      result = await registry.searchContracts(query)
    } else {
      // No filters - get all contracts
      console.log('No filters applied, getting all contracts with pagination')
      result = await registry.searchContracts({ offset, limit })
    }

    console.log('🔍 Search result:', {
      contractCount: result.contracts?.length || 0,
      total: result.total,
      offset: result.offset,
      limit: result.limit,
      queryTime: result.queryTime,
      hasFilters
    })

    console.log('🔧 Registry instance details:', {
      configUsed: 'createDefaultConfig',
      serviceName: 'mainnet-contract-registry'
    })

    // Use the total count from search result (this is the count AFTER applying filters)
    let totalCount = result.total || 0

    // If we get zero results when no filters are applied, this indicates a service issue
    if (totalCount === 0 && !hasFilters) {
      console.warn('⚠️  No contracts returned even without filters - possible service issue')

      // Try alternative method to get contract list
      try {
        const allContractIds = await registry.getAllContracts()
        console.log('getAllContracts() returned:', allContractIds?.length || 0, 'contract IDs')
      } catch (error) {
        console.error('getAllContracts() failed:', error)
      }
    }

    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    const responseTime = Date.now() - startTime
    const responseData = {
      contracts: result.contracts,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        type: contractType || 'all',
        trait: trait || 'all',
        status: status || 'all'
      },
      meta: {
        responseTime,
        timestamp: Date.now()
      }
    }

    // Cache the result for future requests
    setCachedResult(cacheKey, { 
      data: responseData,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    })

    console.log('💾 Cache miss - storing new result')
    
    const response = NextResponse.json(responseData)

    // Add cache and performance headers
    response.headers.set('X-Cache', 'MISS')
    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('X-Total-Count', totalCount.toString())
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300') // 5 minutes
    response.headers.set('ETag', `W/"contracts-${cacheKey}-${Date.now()}"`)

    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch contracts'

    console.error('Failed to fetch contracts:', error)

    const errorResponse = {
      error: true,
      message: errorMessage,
      timestamp: Date.now(),
      responseTime
    }

    return NextResponse.json(errorResponse, {
      status: 500,
      statusText: 'Contract Fetch Error'
    })
  }
}