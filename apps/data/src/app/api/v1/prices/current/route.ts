import { NextRequest, NextResponse } from 'next/server';
import { oraclePriceService } from '@/services/oracle-price-service';
import { blobStorageService } from '@/services/blob-storage-service';
import { generateCacheHeaders } from '@/lib/cache-strategy';

export const runtime = 'edge';

const PRICES_BLOB_PATH = 'prices/current';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/v1/prices/current - Get all current token prices
 * 
 * This is the endpoint that gets called when you click on the "current" folder 
 * under "prices" in the data app tree navigator.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    
    console.log('[Current Prices API] Getting all current prices', { forceRefresh });

    let prices: Record<string, any> = {};
    let dataSource = 'unknown';
    let cacheHit = false;

    // Step 1: Try blob storage first (unless forced refresh)
    if (!forceRefresh) {
      try {
        const blobData = await blobStorageService.get(PRICES_BLOB_PATH);
        
        if (blobData && typeof blobData === 'object') {
          const blobTimestamp = blobData.timestamp || 0;
          const age = Date.now() - blobTimestamp;
          
          if (age < CACHE_TTL) {
            console.log(`[Current Prices API] Using blob cache (age: ${Math.round(age / 1000)}s)`);
            prices = blobData.prices || blobData; // Handle both formats
            dataSource = 'blob-cache';
            cacheHit = true;
          } else {
            console.log(`[Current Prices API] Blob cache expired (age: ${Math.round(age / 1000)}s), fetching fresh data`);
          }
        }
      } catch (error) {
        console.log('[Current Prices API] Blob cache miss, will fetch from oracle service');
      }
    }

    // Step 2: Cache miss or forced refresh - get from oracle service
    if (!cacheHit || forceRefresh) {
      try {
        console.log('[Current Prices API] Fetching from oracle service...');
        
        // Get all available prices from oracle service
        prices = await oraclePriceService.getAllPrices();
        
        // If oracle service returns empty, try to get known tokens
        if (Object.keys(prices).length === 0) {
          console.log('[Current Prices API] Oracle service returned empty, trying known tokens');
          // You could implement a getKnownTokenList() here if needed
        }

        dataSource = forceRefresh ? 'oracle-refresh' : 'oracle-miss';

        // Step 3: Update blob storage with fresh data (background)
        if (Object.keys(prices).length > 0) {
          const blobData = {
            prices,
            timestamp: Date.now(),
            tokenCount: Object.keys(prices).length,
            source: 'oracle-service'
          };

          // Save to blob (don't wait)
          blobStorageService.put(PRICES_BLOB_PATH, blobData).catch(error => {
            console.warn('[Current Prices API] Failed to update blob storage:', error);
          });

          console.log(`[Current Prices API] Updated blob storage with ${Object.keys(prices).length} current prices`);
        }
      } catch (error) {
        console.error('[Current Prices API] Error fetching from oracle service:', error);
        
        // Fallback: try to return stale blob data if available
        try {
          const staleData = await blobStorageService.get(PRICES_BLOB_PATH);
          if (staleData && typeof staleData === 'object') {
            console.log('[Current Prices API] Returning stale blob data as fallback');
            prices = staleData.prices || staleData;
            dataSource = 'stale-blob';
          }
        } catch (fallbackError) {
          console.warn('[Current Prices API] Fallback to stale data also failed');
        }
      }
    }

    // Generate appropriate cache headers
    const cachePolicy = cacheHit 
      ? { sMaxAge: 300, staleWhileRevalidate: 900, browserCache: 60 }
      : { sMaxAge: 60, staleWhileRevalidate: 300, browserCache: 30 };

    const cacheHeaders = generateCacheHeaders(cachePolicy, {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID
    });

    const processingTime = Date.now() - startTime;
    cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
    cacheHeaders.set('X-Data-Source', dataSource);
    cacheHeaders.set('X-Cache-Hit', cacheHit.toString());
    cacheHeaders.set('X-Price-Count', Object.keys(prices).length.toString());

    console.log(`[Current Prices API] Returning ${Object.keys(prices).length} current prices from ${dataSource} in ${processingTime}ms`);

    return NextResponse.json(prices, { headers: cacheHeaders });

  } catch (error) {
    console.error('[Current Prices API] Unexpected error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch current prices',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}