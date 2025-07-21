import { NextRequest, NextResponse } from 'next/server'
import { fetchAllStats, fetchRegistryStats, fetchStorageStats, fetchDiscoveryStats, fetchHealthStats } from '@/lib/contract-registry'

// Simple in-memory cache for stats results
const statsCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
const STATS_CACHE_TTL = 2 * 60 * 1000 // 2 minutes (stats change less frequently)
const MAX_STATS_CACHE_SIZE = 20 // Smaller cache for stats

function getStatsCacheKey(type: string | null): string {
  return type || 'all'
}

function getCachedStats(cacheKey: string) {
  const cached = statsCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }
  // Clean up expired entry
  if (cached) {
    statsCache.delete(cacheKey)
  }
  return null
}

function setCachedStats(cacheKey: string, data: any, customTtl?: number) {
  // Prevent cache from growing too large
  if (statsCache.size >= MAX_STATS_CACHE_SIZE) {
    // Remove oldest entries
    const oldestKey = statsCache.keys().next().value
    if (oldestKey) statsCache.delete(oldestKey)
  }
  
  statsCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl: customTtl || STATS_CACHE_TTL
  })
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'registry', 'storage', 'discovery', 'health', or null for all
    const cacheKey = getStatsCacheKey(type)

    // Check cache first
    const cachedResult = getCachedStats(cacheKey)
    if (cachedResult) {
      console.log(`🎯 Cache hit for stats request (type: ${type || 'all'})`)
      const response = NextResponse.json({
        success: true,
        data: cachedResult.data,
        meta: {
          cached: true,
          cacheKey,
          responseTime: Date.now() - startTime,
          timestamp: cachedResult.timestamp
        }
      })
      
      // Add cache headers
      response.headers.set('X-Cache', 'HIT')
      response.headers.set('X-Cache-TTL', Math.floor((cachedResult.timestamp + STATS_CACHE_TTL - Date.now()) / 1000).toString())
      response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=120') // 2 minutes
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
      
      return response
    }

    console.log(`📊 Fetching stats (type: ${type || 'all'})`)

    let stats
    
    switch (type) {
      case 'registry':
        stats = await fetchRegistryStats()
        break
      case 'storage':
        stats = await fetchStorageStats()
        break
      case 'discovery':
        stats = await fetchDiscoveryStats()
        break
      case 'health':
        stats = await fetchHealthStats()
        break
      case null:
      case undefined:
      case 'all':
      default:
        stats = await fetchAllStats()
        break
    }

    // Cache the result
    setCachedStats(cacheKey, stats)
    
    console.log(`💾 Cache miss - storing new stats result (type: ${type || 'all'})`)

    const responseTime = Date.now() - startTime
    const response = NextResponse.json({
      success: true,
      data: stats,
      meta: {
        cached: false,
        cacheKey,
        responseTime,
        timestamp: Date.now(),
        type: type || 'all'
      }
    })

    // Add cache and performance headers
    response.headers.set('X-Cache', 'MISS')
    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=120') // 2 minutes
    response.headers.set('ETag', `W/"stats-${cacheKey}-${Date.now()}"`)
    response.headers.set('X-Stats-Type', type || 'all')

    return response

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch stats'

    console.error('Failed to fetch stats:', error)

    const errorResponse = {
      success: false,
      error: true,
      message: errorMessage,
      timestamp: Date.now(),
      responseTime
    }

    return NextResponse.json(errorResponse, {
      status: 500,
      statusText: 'Stats Fetch Error',
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Cache': 'ERROR'
      }
    })
  }
}