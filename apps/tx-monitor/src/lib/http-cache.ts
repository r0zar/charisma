import type { TransactionStatus } from './types';

/**
 * Cache configuration for different transaction statuses
 */
export const CACHE_CONFIG = {
  // Confirmed transactions are immutable - cache for 1 hour
  success: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 24 hours
    mustRevalidate: false
  },
  // Failed transactions are also immutable - cache for 1 hour
  abort_by_response: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 24 hours
    mustRevalidate: false
  },
  abort_by_post_condition: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 86400, // 24 hours
    mustRevalidate: false
  },
  // Pending transactions change frequently - short cache
  pending: {
    maxAge: 30, // 30 seconds
    staleWhileRevalidate: 300, // 5 minutes
    mustRevalidate: true
  },
  // Not found transactions - very short cache in case it gets broadcasted
  not_found: {
    maxAge: 10, // 10 seconds
    staleWhileRevalidate: 60, // 1 minute
    mustRevalidate: true
  },
  // Queue stats change frequently
  stats: {
    maxAge: 60, // 1 minute
    staleWhileRevalidate: 300, // 5 minutes
    mustRevalidate: true
  }
} as const;

/**
 * Generate cache headers for transaction status responses
 */
export function getTransactionCacheHeaders(status: TransactionStatus, fromCache: boolean = false): Record<string, string> {
  const config = CACHE_CONFIG[status];
  
  const headers: Record<string, string> = {
    'Cache-Control': `public, max-age=${config.maxAge}, stale-while-revalidate=${config.staleWhileRevalidate}${config.mustRevalidate ? ', must-revalidate' : ''}`,
    'Vary': 'Accept-Encoding'
  };
  
  // Add ETag for confirmed transactions
  if (status === 'success' || status === 'abort_by_response' || status === 'abort_by_post_condition') {
    headers['ETag'] = `"${status}-${Date.now()}"`;
  }
  
  // Add cache status header for debugging
  headers['X-Cache-Status'] = fromCache ? 'HIT' : 'MISS';
  
  return headers;
}

/**
 * Generate cache headers for queue stats
 */
export function getStatsCacheHeaders(): Record<string, string> {
  const config = CACHE_CONFIG.stats;
  
  return {
    'Cache-Control': `public, max-age=${config.maxAge}, stale-while-revalidate=${config.staleWhileRevalidate}, must-revalidate`,
    'Vary': 'Accept-Encoding',
    'X-Cache-Status': 'MISS'
  };
}

/**
 * Generate cache headers for queue add endpoint (no caching)
 */
export function getQueueAddCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
}

/**
 * Check if request has valid conditional headers for caching
 */
export function checkConditionalHeaders(request: Request, etag?: string, lastModified?: Date): boolean {
  const ifNoneMatch = request.headers.get('If-None-Match');
  const ifModifiedSince = request.headers.get('If-Modified-Since');
  
  // Check ETag
  if (etag && ifNoneMatch) {
    return ifNoneMatch === etag;
  }
  
  // Check Last-Modified
  if (lastModified && ifModifiedSince) {
    const requestTime = new Date(ifModifiedSince);
    return requestTime >= lastModified;
  }
  
  return false;
}