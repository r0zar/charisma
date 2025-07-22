import { NextRequest, NextResponse } from 'next/server';
import { oraclePriceService } from '@/lib/prices';
import { blobStorageService } from '@/lib/storage/blob-storage-service';
import { generateCacheHeaders } from '@/lib/utils/cache-strategy';

export const runtime = 'edge';

const PRICES_BLOB_PATH = 'prices/current';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/v1/prices/[contractId] - Get price for a specific token with oracle integration
 * 
 * Flow:
 * 1. Try to get from blob storage first (fastest)
 * 2. On cache miss, fetch from oracle service
 * 3. Update blob storage with fresh data
 * 4. Return price to client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const startTime = Date.now();

  try {
    const { contractId } = await params;
    
    // Convert URL format back to contract ID (e.g., "SP1234/token" -> "SP1234.token")
    const tokenId = contractId.includes('/') 
      ? contractId.replace('/', '.') 
      : contractId;

    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    console.log(`[Price API] Getting price for ${tokenId}`, { forceRefresh });

    let priceData: any = null;
    let dataSource = 'unknown';
    let cacheHit = false;

    // Step 1: Try blob storage first (unless forced refresh)
    if (!forceRefresh) {
      try {
        const blobData = await blobStorageService.get(PRICES_BLOB_PATH);
        
        if (blobData && typeof blobData === 'object') {
          const prices = blobData.prices || blobData;
          const blobTimestamp = blobData.timestamp || 0;
          const age = Date.now() - blobTimestamp;
          
          if (age < CACHE_TTL && prices[tokenId]) {
            console.log(`[Price API] Using blob cache for ${tokenId} (age: ${Math.round(age / 1000)}s)`);
            priceData = prices[tokenId];
            dataSource = 'blob-cache';
            cacheHit = true;
          } else if (prices[tokenId]) {
            console.log(`[Price API] Blob cache expired for ${tokenId} (age: ${Math.round(age / 1000)}s), fetching fresh`);
          }
        }
      } catch (error) {
        console.log(`[Price API] Blob cache miss for ${tokenId}, will fetch from oracle service`);
      }
    }

    // Step 2: Cache miss or forced refresh - get from oracle service
    if (!cacheHit || forceRefresh) {
      try {
        console.log(`[Price API] Fetching ${tokenId} from oracle service...`);
        
        const freshPriceData = await oraclePriceService.getTokenPrice(tokenId);
        
        if (freshPriceData) {
          priceData = freshPriceData;
          dataSource = forceRefresh ? 'oracle-refresh' : 'oracle-miss';

          // Step 3: Update blob storage with fresh data (background)
          try {
            // Get existing blob data
            let existingBlobData: any = {};
            try {
              existingBlobData = await blobStorageService.get(PRICES_BLOB_PATH) || {};
            } catch (error) {
              // Ignore errors, start with empty data
            }

            // Ensure we have the right structure
            const existingPrices = existingBlobData.prices || existingBlobData;
            
            // Update with new price
            const updatedPrices = {
              ...existingPrices,
              [tokenId]: priceData
            };

            const blobData = {
              prices: updatedPrices,
              timestamp: Date.now(),
              tokenCount: Object.keys(updatedPrices).length,
              source: 'oracle-service',
              lastUpdatedToken: tokenId
            };

            // Save to blob (don't wait)
            blobStorageService.put(PRICES_BLOB_PATH, blobData).catch(error => {
              console.warn(`[Price API] Failed to update blob storage for ${tokenId}:`, error);
            });

            console.log(`[Price API] Updated blob storage with fresh price for ${tokenId}`);
          } catch (updateError) {
            console.warn(`[Price API] Error updating blob storage for ${tokenId}:`, updateError);
          }
        }
      } catch (error) {
        console.error(`[Price API] Error fetching from oracle service for ${tokenId}:`, error);
        
        // Fallback: try to return stale blob data if available
        try {
          const staleData = await blobStorageService.get(PRICES_BLOB_PATH);
          if (staleData && typeof staleData === 'object') {
            const stalePrices = staleData.prices || staleData;
            if (stalePrices[tokenId]) {
              console.log(`[Price API] Returning stale blob data for ${tokenId} as fallback`);
              priceData = stalePrices[tokenId];
              dataSource = 'stale-blob';
            }
          }
        } catch (fallbackError) {
          console.warn(`[Price API] Fallback to stale data also failed for ${tokenId}`);
        }
      }
    }

    // Return 404 if no price data found
    if (!priceData) {
      return NextResponse.json(
        {
          error: 'Price not available',
          tokenId,
          message: 'No price data found from any source',
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
    }

    // Generate appropriate cache headers
    const cachePolicy = cacheHit 
      ? { sMaxAge: 300, staleWhileRevalidate: 900, browserCache: 60 }
      : { sMaxAge: 60, staleWhileRevalidate: 300, browserCache: 30 }; // Shorter cache for fresh data

    const cacheHeaders = generateCacheHeaders(cachePolicy, {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID
    });

    const processingTime = Date.now() - startTime;
    cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
    cacheHeaders.set('X-Data-Source', dataSource);
    cacheHeaders.set('X-Cache-Hit', cacheHit.toString());
    cacheHeaders.set('X-Token-Id', tokenId);

    console.log(`[Price API] Returning price for ${tokenId} from ${dataSource} in ${processingTime}ms`);

    return NextResponse.json(priceData, { headers: cacheHeaders });

  } catch (error) {
    console.error('[Price API] Unexpected error:', error);

    const { contractId } = await params;
    const tokenId = contractId.includes('/') ? contractId.replace('/', '.') : contractId;

    return NextResponse.json(
      {
        error: 'Failed to fetch token price',
        tokenId,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}