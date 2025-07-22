import { NextRequest, NextResponse } from 'next/server';
import { simplePriceService } from '@/lib/prices/simple-price-service';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Simple price collection cron - no memory leaks
 * GET /api/cron/collect-prices - Collect and store current prices
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('[PriceCron] Starting simple price collection...');
    
    // Get current prices quickly - force refresh for cron
    const prices = await simplePriceService.getCurrentPrices(true);
    const priceCount = Object.keys(prices).length;
    
    if (priceCount > 0) {
      // Get existing prices blob to preserve structure
      const pricesBlob = await unifiedBlobStorage.get('prices') || {};
      
      // Update the current section
      (pricesBlob as any).current = {
        timestamp: Date.now(),
        prices,
        tokenCount: priceCount,
        source: 'simple-cron'
      };
      
      // Store back to prices blob
      await unifiedBlobStorage.put('prices', pricesBlob);
      
      console.log(`[PriceCron] Stored ${priceCount} prices in prices/current`);
    }
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      collection: {
        pricesCollected: priceCount,
        errors: [],
        errorCount: 0
      },
      source: 'simple-service'
    });
    
  } catch (error) {
    console.error('[PriceCron] Error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      error: 'Price collection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support POST for cron services
export const POST = GET;