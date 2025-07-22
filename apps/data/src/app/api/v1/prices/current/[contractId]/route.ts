import { NextRequest, NextResponse } from 'next/server';
import { simplePriceService } from '@/lib/prices/simple-price-service';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';
import { generateCacheHeaders } from '@/lib/utils/cache-strategy';

export const runtime = 'edge';

const PRICES_BLOB_PATH = 'prices/current';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/v1/prices/current/[contractId] - Get current price for a specific token
 * 
 * This handles individual token price access under the current prices directory
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

    console.log(`[Current Price API] Getting current price for ${tokenId}`, { forceRefresh });

    let priceData: any = null;
    let dataSource = 'unknown';
    let cacheHit = false;

    // Step 1: Try blob storage first (unless forced refresh)
    if (!forceRefresh) {
      try {
        const blobData = await unifiedBlobStorage.get(PRICES_BLOB_PATH);
        
        if (blobData && typeof blobData === 'object') {
          const prices = blobData.prices || blobData;
          const blobTimestamp = blobData.timestamp || 0;
          const age = Date.now() - blobTimestamp;
          
          if (age < CACHE_TTL && prices[tokenId]) {
            console.log(`[Current Price API] Using blob cache for ${tokenId} (age: ${Math.round(age / 1000)}s)`);
            priceData = prices[tokenId];
            dataSource = 'blob-cache';
            cacheHit = true;
          } else if (prices[tokenId]) {
            console.log(`[Current Price API] Blob cache expired for ${tokenId} (age: ${Math.round(age / 1000)}s), fetching fresh`);
          }
        }
      } catch (error) {
        console.log(`[Current Price API] Blob cache miss for ${tokenId}, will fetch from oracle service`);
      }
    }

    // Step 2: Cache miss or forced refresh - get from oracle service
    if (!cacheHit || forceRefresh) {
      try {
        console.log(`[Current Price API] Fetching ${tokenId} from oracle service...`);
        
        const freshPriceData = await simplePriceService.getPrice(tokenId);
        
        if (freshPriceData) {
          priceData = freshPriceData;
          dataSource = forceRefresh ? 'oracle-refresh' : 'oracle-miss';

          // Step 3: Update blob storage with fresh data (background)
          try {
            // Get existing blob data
            let existingBlobData: any = {};
            try {
              existingBlobData = await unifiedBlobStorage.get(PRICES_BLOB_PATH) || {};
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
            unifiedBlobStorage.put(PRICES_BLOB_PATH, blobData).catch(error => {
              console.warn(`[Current Price API] Failed to update blob storage for ${tokenId}:`, error);
            });

            console.log(`[Current Price API] Updated blob storage with fresh current price for ${tokenId}`);
          } catch (updateError) {
            console.warn(`[Current Price API] Error updating blob storage for ${tokenId}:`, updateError);
          }
        }
      } catch (error) {
        console.error(`[Current Price API] Error fetching from oracle service for ${tokenId}:`, error);
        
        // Fallback: try to return stale blob data if available
        try {
          const staleData = await unifiedBlobStorage.get(PRICES_BLOB_PATH);
          if (staleData && typeof staleData === 'object') {
            const stalePrices = staleData.prices || staleData;
            if (stalePrices[tokenId]) {
              console.log(`[Current Price API] Returning stale blob data for ${tokenId} as fallback`);
              priceData = stalePrices[tokenId];
              dataSource = 'stale-blob';
            }
          }
        } catch (fallbackError) {
          console.warn(`[Current Price API] Fallback to stale data also failed for ${tokenId}`);
        }
      }
    }

    // Return 404 if no price data found
    if (!priceData) {
      return NextResponse.json(
        {
          error: 'Current price not available',
          tokenId,
          message: 'No current price data found from any source',
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
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
    cacheHeaders.set('X-Token-Id', tokenId);

    console.log(`[Current Price API] Returning current price for ${tokenId} from ${dataSource} in ${processingTime}ms`);

    return NextResponse.json(priceData, { headers: cacheHeaders });

  } catch (error) {
    console.error('[Current Price API] Unexpected error:', error);

    const { contractId } = await params;
    const tokenId = contractId.includes('/') ? contractId.replace('/', '.') : contractId;

    return NextResponse.json(
      {
        error: 'Failed to fetch current token price',
        tokenId,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}