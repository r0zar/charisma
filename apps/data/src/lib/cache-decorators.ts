/**
 * Elegant cache decorator pattern for API routes
 * Simplifies caching complexity into clean, reusable decorators
 */

import { NextRequest, NextResponse } from 'next/server';
import { CACHE_POLICIES, generateCacheHeaders, type CachePolicy } from './cache-strategy';

type APIHandler = (request: NextRequest, context: any) => Promise<NextResponse>;

interface CacheOptions {
  policy?: CachePolicy;
  keyGenerator?: (request: NextRequest, context: any) => string;
  condition?: (request: NextRequest, context: any) => boolean;
  geo?: boolean;
}

/**
 * Cache decorator factory - creates cached versions of API handlers
 */
export function cache(
  policyName: keyof typeof CACHE_POLICIES | CachePolicy,
  options: CacheOptions = {}
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod: APIHandler = descriptor.value;

    descriptor.value = async function (request: NextRequest, context: any): Promise<NextResponse> {
      const startTime = Date.now();

      try {
        // Get cache policy
        const policy = typeof policyName === 'string' 
          ? CACHE_POLICIES[policyName] 
          : policyName;

        // Check cache condition
        if (options.condition && !options.condition(request, context)) {
          return await originalMethod.call(this, request, context);
        }

        // Generate cache key
        const cacheKey = options.keyGenerator 
          ? options.keyGenerator(request, context)
          : generateDefaultCacheKey(request, context);

        // Call original method
        const response = await originalMethod.call(this, request, context);

        // If response is not ok, don't cache
        if (!response.ok) {
          return response;
        }

        // Generate cache headers
        const cacheHeaders = generateCacheHeaders(policy, {
          geoSpecific: options.geo,
          country: request.headers.get('x-vercel-ip-country') || undefined,
          deploymentId: process.env.VERCEL_DEPLOYMENT_ID
        });

        // Add performance headers
        const processingTime = Date.now() - startTime;
        cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
        cacheHeaders.set('X-Cache-Key', cacheKey);

        // Clone response with cache headers
        const cachedResponse = new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: { ...Object.fromEntries(response.headers), ...Object.fromEntries(cacheHeaders) }
        });

        return cachedResponse;

      } catch (error) {
        console.error(`Cache decorator error for ${propertyKey}:`, error);
        return await originalMethod.call(this, request, context);
      }
    };

    return descriptor;
  };
}

/**
 * Specific cache decorators for common patterns
 */

export const cacheAddresses = (options: Omit<CacheOptions, 'policy'> = {}) =>
  cache('BALANCES', options);

export const cachePrices = (options: Omit<CacheOptions, 'policy'> = {}) =>
  cache('PRICES', { ...options, geo: true });

export const cacheContracts = (options: Omit<CacheOptions, 'policy'> = {}) =>
  cache('CONTRACTS', options);

export const cacheTransactions = (options: Omit<CacheOptions, 'policy'> = {}) =>
  cache('TRANSACTIONS', options);

export const noCache = (options: Omit<CacheOptions, 'policy'> = {}) =>
  cache('STREAMING', options);

/**
 * Conditional caching decorators
 */

export const cacheIf = (condition: (req: NextRequest, ctx: any) => boolean) =>
  (policyName: keyof typeof CACHE_POLICIES) =>
    cache(policyName, { condition });

export const cacheUnlessStreaming = cacheIf((req) => 
  req.nextUrl.searchParams.get('stream') !== 'true'
);

/**
 * Geographic caching decorator
 */
export const geoCache = (policyName: keyof typeof CACHE_POLICIES) =>
  cache(policyName, { geo: true });

/**
 * Helper functions
 */

function generateDefaultCacheKey(request: NextRequest, context: any): string {
  const url = request.nextUrl;
  const path = context.params?.path?.join('/') || 'root';
  const query = url.searchParams.toString();
  
  const key = query ? `${path}?${query}` : path;
  return Buffer.from(key).toString('base64').slice(0, 32);
}

/**
 * Cache management utilities
 */
export class CacheManager {
  private static readonly CACHE_VERSION = 'v1';

  /**
   * Creates a versioned cache key
   */
  static createVersionedKey(baseKey: string, version?: string): string {
    const v = version || this.CACHE_VERSION;
    return `${v}:${baseKey}`;
  }

  /**
   * Extracts cache info from headers
   */
  static getCacheInfo(response: NextResponse): {
    key?: string;
    policy?: string;
    hit?: boolean;
    age?: number;
  } {
    return {
      key: response.headers.get('X-Cache-Key') || undefined,
      policy: response.headers.get('X-Cache-Policy') || undefined,
      hit: response.headers.get('X-Cache-Status') === 'HIT',
      age: parseInt(response.headers.get('Age') || '0', 10)
    };
  }

  /**
   * Debug cache performance
   */
  static logCachePerformance(response: NextResponse, operation: string): void {
    const info = this.getCacheInfo(response);
    const responseTime = response.headers.get('X-Response-Time');
    
    console.log(`Cache ${operation}:`, {
      key: info.key,
      hit: info.hit,
      age: info.age,
      responseTime,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Type-safe cache decorator with path-based policy selection
 */
export function smartCache(options: { debug?: boolean } = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod: APIHandler = descriptor.value;

    descriptor.value = async function (request: NextRequest, context: any): Promise<NextResponse> {
      const path = context.params?.path as string[] || [];
      const isStreaming = request.nextUrl.searchParams.get('stream') === 'true';
      
      // Determine policy based on path
      let policyName: keyof typeof CACHE_POLICIES = 'BALANCES'; // default
      
      if (isStreaming) {
        policyName = 'STREAMING';
      } else if (path.length === 0) {
        policyName = 'ROOT';
      } else {
        const [type] = path;
        switch (type) {
          case 'prices': policyName = 'PRICES'; break;
          case 'addresses': policyName = 'BALANCES'; break;
          case 'contracts': policyName = 'CONTRACTS'; break;
          case 'transactions': policyName = 'TRANSACTIONS'; break;
        }
      }

      // Apply cache decorator
      const cacheDecorator = cache(policyName, {
        geo: path[0] === 'prices',
        keyGenerator: (req, ctx) => {
          const pathStr = ctx.params?.path?.join('/') || 'root';
          const query = req.nextUrl.searchParams.toString();
          return CacheManager.createVersionedKey(
            query ? `${pathStr}?${query}` : pathStr
          );
        }
      });

      // Apply decorator to original method
      const cachedDescriptor = { value: originalMethod };
      cacheDecorator(target, propertyKey, cachedDescriptor);
      
      const response = await cachedDescriptor.value.call(this, request, context);

      if (options.debug) {
        CacheManager.logCachePerformance(response, propertyKey);
      }

      return response;
    };

    return descriptor;
  };
}