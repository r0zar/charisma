import { NextRequest, NextResponse } from 'next/server';
import { simplePriceService } from '@/lib/prices/simple-price-service';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Convert contract ID to simple token name for display
 */
function getSimpleTokenName(contractId: string): string {
  const parts = contractId.split('.');
  if (parts.length === 2) {
    const tokenName = parts[1];
    if (tokenName.includes('-token')) {
      return tokenName.replace('-token', '').toUpperCase();
    } else if (tokenName.includes('coin')) {
      return tokenName.replace('coin', '').toUpperCase();
    } else if (tokenName === 'arkadiko-token') {
      return 'DIKO';
    } else if (tokenName === 'alex-token') {
      return 'ALEX';
    } else if (tokenName === 'charisma-token') {
      return 'CHA';
    } else if (tokenName === 'welshcorgicoin-token') {
      return 'WELSH';
    } else if (tokenName === 'sbtc-token') {
      return 'SBTC';
    }
    return tokenName.toUpperCase().slice(0, 10);
  }
  return contractId.slice(0, 10);
}

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
      let pricesBlob: any;
      try {
        pricesBlob = await unifiedBlobStorage.get('prices') || {};
      } catch (error) {
        pricesBlob = {};
      }
      
      // Store each token directly under prices/ (simplified - current price only)
      for (const [contractId, priceData] of Object.entries(prices)) {
        const tokenData = {
          currentPrice: (priceData as any).usdPrice,
          source: (priceData as any).source,
          lastUpdated: Date.now(),
          metadata: {
            contractId,
            symbol: getSimpleTokenName(contractId)
          }
        };
        
        // Store individual token
        await unifiedBlobStorage.put(`prices/${contractId}`, tokenData);
        
        // Also add to main prices blob for tree building
        pricesBlob[contractId] = tokenData;
        
        // Also update price-series with historical data
        try {
          let seriesData: any = {};
          try {
            seriesData = await unifiedBlobStorage.get(`price-series/${contractId}`) || { dataPoints: [] };
          } catch (error) {
            seriesData = { dataPoints: [] };
          }
          
          // Add new price point to series
          const pricePoint = {
            timestamp: Date.now(),
            usdPrice: (priceData as any).usdPrice,
            source: (priceData as any).source
          };
          
          // Keep only last 100 points to manage size
          seriesData.dataPoints = seriesData.dataPoints || [];
          seriesData.dataPoints.push(pricePoint);
          if (seriesData.dataPoints.length > 100) {
            seriesData.dataPoints = seriesData.dataPoints.slice(-100);
          }
          
          seriesData.lastUpdated = Date.now();
          seriesData.metadata = {
            contractId,
            symbol: getSimpleTokenName(contractId),
            pointCount: seriesData.dataPoints.length
          };
          
          // Store series data
          await unifiedBlobStorage.put(`price-series/${contractId}`, seriesData);
          
        } catch (seriesError) {
          console.warn(`[PriceCron] Failed to update price series for ${contractId}:`, seriesError);
        }
      }
      
      // Add metadata to prices blob
      pricesBlob.lastUpdated = new Date().toISOString();
      pricesBlob.source = 'simple-cron';
      pricesBlob.tokenCount = priceCount;
      
      // Store the updated prices blob
      await unifiedBlobStorage.put('prices', pricesBlob);
      
      console.log(`[PriceCron] Stored ${priceCount} tokens directly in prices/`);
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