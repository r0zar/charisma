/**
 * Vercel Edge Network cache strategy with differentiated policies
 * Optimized for Vercel's 119 PoPs across 94 cities and 19 compute regions
 */

export interface CachePolicy {
  sMaxAge: number;        // CDN cache duration in seconds
  staleWhileRevalidate: number; // Stale serving window in seconds
  browserCache: number;   // Browser cache duration in seconds
  vary?: string[];        // Vary headers for geo-specific content
}

/**
 * Cache policies optimized for different data types
 */
export const CACHE_POLICIES = {
  // High-frequency market data - 5min cache, 30min stale
  PRICES: {
    sMaxAge: 300,
    staleWhileRevalidate: 1800,
    browserCache: 60
  } as CachePolicy,
  
  // Moderately dynamic wallet data - 15min cache, 1hr stale
  BALANCES: {
    sMaxAge: 900,
    staleWhileRevalidate: 3600,
    browserCache: 300
  } as CachePolicy,
  
  // Relatively static on-chain data - 30min cache, 2hr stale
  CONTRACTS: {
    sMaxAge: 1800,
    staleWhileRevalidate: 7200,
    browserCache: 600
  } as CachePolicy,
  
  // Immutable transaction data - 1hr cache, 24hr stale
  TRANSACTIONS: {
    sMaxAge: 3600,
    staleWhileRevalidate: 86400,
    browserCache: 1800
  } as CachePolicy,
  
  // Root blob data - moderate cache
  ROOT: {
    sMaxAge: 600,
    staleWhileRevalidate: 1800,
    browserCache: 300
  } as CachePolicy,
  
  // Real-time streaming data - no cache
  STREAMING: {
    sMaxAge: 0,
    staleWhileRevalidate: 0,
    browserCache: 0
  } as CachePolicy,
  
  // Tree navigation data - moderate cache
  TREE: {
    sMaxAge: 600,
    staleWhileRevalidate: 1800,
    browserCache: 300
  } as CachePolicy
} as const;

/**
 * Determines cache policy based on API path
 */
export function getCachePolicy(path: string[] | string, stream: boolean = false): CachePolicy {
  if (stream) {
    return CACHE_POLICIES.STREAMING;
  }
  
  // Handle root path
  if (path === 'root') {
    return CACHE_POLICIES.ROOT;
  }
  
  // Handle array paths
  if (!Array.isArray(path)) {
    return CACHE_POLICIES.ROOT;
  }
  
  const [type, , action] = path;
  
  switch (type) {
    case 'prices':
      return CACHE_POLICIES.PRICES;
      
    case 'addresses':
      if (action === 'balances') {
        return CACHE_POLICIES.BALANCES;
      } else if (action === 'transactions') {
        return CACHE_POLICIES.TRANSACTIONS;
      }
      return CACHE_POLICIES.BALANCES;
      
    case 'contracts':
      return CACHE_POLICIES.CONTRACTS;
      
    default:
      return CACHE_POLICIES.BALANCES; // Default to moderate caching
  }
}

/**
 * Generates optimized cache headers for Vercel Edge Network
 */
export function generateCacheHeaders(policy: CachePolicy, options?: {
  geoSpecific?: boolean;
  country?: string;
  deploymentId?: string;
}): Headers {
  const headers = new Headers();
  
  if (policy.sMaxAge === 0) {
    // No caching for streaming/real-time data
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('CDN-Cache-Control', 'no-cache');
    headers.set('Vercel-CDN-Cache-Control', 'no-cache');
  } else {
    // Optimized cache headers for Vercel Edge Network
    const cacheControl = [
      `public`,
      `max-age=${policy.browserCache}`,
      `s-maxage=${policy.sMaxAge}`,
      `stale-while-revalidate=${policy.staleWhileRevalidate}`
    ].join(', ');
    
    headers.set('Cache-Control', cacheControl);
    
    // Vercel-specific CDN headers for granular control
    headers.set('CDN-Cache-Control', `max-age=${policy.sMaxAge}`);
    headers.set('Vercel-CDN-Cache-Control', 
      `max-age=${policy.sMaxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`
    );
  }
  
  // Geo-specific blockchain data support
  if (options?.geoSpecific) {
    const vary = ['Accept-Encoding', 'X-Vercel-IP-Country'];
    if (policy.vary) {
      vary.push(...policy.vary);
    }
    headers.set('Vary', vary.join(', '));
  } else {
    headers.set('Vary', 'Accept-Encoding');
  }
  
  // Deployment-specific cache segmentation
  if (options?.deploymentId) {
    headers.set('X-Cache-Key-Suffix', options.deploymentId);
  }
  
  // Content optimization headers
  headers.set('Content-Type', 'application/json');
  headers.set('Content-Encoding', 'identity'); // Let Vercel handle compression
  
  return headers;
}

/**
 * Generates cache debugging headers for performance monitoring
 */
export function generateDebugHeaders(policy: CachePolicy, path: string): Headers {
  const headers = new Headers();
  
  // Cache policy identification
  headers.set('X-Cache-Policy', JSON.stringify({
    sMaxAge: policy.sMaxAge,
    staleWhileRevalidate: policy.staleWhileRevalidate,
    path: path
  }));
  
  // Timestamp for cache analysis
  headers.set('X-Generated-At', new Date().toISOString());
  
  // Cache key hint for debugging
  const cacheKey = generateCacheKey(path);
  headers.set('X-Cache-Key-Hint', cacheKey);
  
  return headers;
}

/**
 * Generates deterministic cache keys for Vercel Edge Network
 */
export function generateCacheKey(path: string): string {
  // Normalized cache key for consistent CDN behavior
  const normalizedPath = path.toLowerCase().replace(/\/+/g, '/');
  return Buffer.from(normalizedPath).toString('base64').slice(0, 32);
}

/**
 * Cache invalidation utilities
 */
export class CacheInvalidator {
  /**
   * Manually purge CDN cache for emergency clearing
   * Note: This would require Vercel API integration in production
   */
  static async purgePath(path: string): Promise<void> {
    // In production, this would call Vercel's Purge API
    console.log(`Cache purge requested for: ${path}`);
    
    // For development, we can simulate by adding cache-busting headers
    const cacheKey = generateCacheKey(path);
    console.log(`Cache key: ${cacheKey}`);
  }
  
  /**
   * Purge related cache entries based on data relationships
   */
  static async purgeRelated(path: string): Promise<void> {
    const [type, address] = path.split('/');
    
    const relatedPaths: string[] = [];
    
    switch (type) {
      case 'addresses':
        // Purge all address-related data
        relatedPaths.push(
          `addresses/${address}/balances`,
          `addresses/${address}/transactions`,
          `tree` // Tree structure may change
        );
        break;
        
      case 'contracts':
        // Purge contract and related address data
        relatedPaths.push(
          `contracts/${address}`,
          `addresses/${address}/balances`, // Contract deployment affects balances
          `tree`
        );
        break;
        
      case 'prices':
        // Purge price data
        relatedPaths.push(path, `tree`);
        break;
    }
    
    for (const relatedPath of relatedPaths) {
      await this.purgePath(relatedPath);
    }
  }
}

/**
 * Edge Network optimization utilities
 */
export class EdgeOptimizer {
  /**
   * Optimizes response for Vercel's Edge Network characteristics
   */
  static optimizeResponse(data: any, policy: CachePolicy): any {
    // For large responses, consider compression hints
    const dataStr = JSON.stringify(data);
    
    if (dataStr.length > 100000) { // 100KB threshold
      // Add metadata for edge optimization
      return {
        ...data,
        _meta: {
          size: dataStr.length,
          compressed: true,
          cachePolicy: policy.sMaxAge > 0 ? 'cached' : 'no-cache'
        }
      };
    }
    
    return data;
  }
  
  /**
   * Checks if response meets Vercel's cacheable criteria
   */
  static isCacheableResponse(headers: Headers, status: number, size: number): boolean {
    // Vercel's caching requirements:
    // - GET/HEAD methods (handled by route)
    // - No Authorization headers
    // - 200/404 status codes
    // - Under 10MB response size
    // - No set-cookie headers
    
    return (
      status === 200 || status === 404
    ) && (
      size < 10 * 1024 * 1024 // 10MB limit
    ) && (
      !headers.has('Authorization')
    ) && (
      !headers.has('Set-Cookie')
    );
  }
}