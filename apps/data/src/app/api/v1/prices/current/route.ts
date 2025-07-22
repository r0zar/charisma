import { NextRequest, NextResponse } from 'next/server';
import { simplePriceService } from '@/lib/prices/simple-price-service';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Get current token prices - simplified structure
 * GET /api/v1/prices/current - Get all current token prices from prices blob
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    
    console.log(`[Prices] Getting current prices (refresh: ${forceRefresh})`);
    
    // Get current prices from the simplified blob structure
    let currentPrices: any = {};
    let tokenCount = 0;
    
    try {
      const pricesBlob = await unifiedBlobStorage.get('prices');
      if (pricesBlob && typeof pricesBlob === 'object') {
        // Extract current prices from each token
        for (const [key, value] of Object.entries(pricesBlob)) {
          // Skip metadata fields
          if (key === 'lastUpdated' || key === 'source' || key === 'tokenCount') {
            continue;
          }
          
          // If this looks like a contract ID, extract current price
          if (typeof key === 'string' && key.includes('.') && value && typeof value === 'object') {
            const tokenData = value as any;
            if (tokenData.currentPrice !== undefined) {
              currentPrices[key] = {
                usdPrice: tokenData.currentPrice,
                source: tokenData.source || 'unknown',
                timestamp: tokenData.lastUpdated || Date.now()
              };
              tokenCount++;
            }
          }
        }
      }
    } catch (error) {
      console.log('[Prices] No existing prices data, returning from service');
      // Fall back to simple service if no blob data
      const prices = await simplePriceService.getCurrentPrices(forceRefresh);
      currentPrices = prices;
      tokenCount = Object.keys(prices).length;
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`[Prices] Returned ${tokenCount} prices in ${processingTime}ms`);
    
    const response = {
      timestamp: Date.now(),
      prices: currentPrices,
      tokenCount,
      source: forceRefresh ? 'blob-refresh' : 'blob-cached'
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[Prices] Error:', error);
    
    return NextResponse.json({
      error: 'Failed to get current prices',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { status: 500 });
  }
}