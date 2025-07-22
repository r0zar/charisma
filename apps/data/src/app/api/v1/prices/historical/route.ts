import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * GET /api/v1/prices/historical - Get historical price data
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    
    console.log(`[Historical] Getting historical data (refresh: ${forceRefresh})`);
    
    // Get historical data from blob storage
    const pricesBlob = await unifiedBlobStorage.get('prices');
    let historicalData = null;
    
    if (pricesBlob && typeof pricesBlob === 'object') {
      historicalData = (pricesBlob as any).historical;
    }
    
    // If no historical data exists or is empty object, create proper structure
    if (!historicalData || (typeof historicalData === 'object' && Object.keys(historicalData).length === 0)) {
      historicalData = {
        timestamp: Date.now(),
        timeframes: {
          '5m': {},
          '1h': {},
          '1d': {}
        },
        totalTokens: 0,
        oldestEntry: null,
        newestEntry: null,
        source: 'empty-structure'
      };
      
      // Store the empty structure back to blob
      if (pricesBlob) {
        (pricesBlob as any).historical = historicalData;
        await unifiedBlobStorage.put('prices', pricesBlob);
      }
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`[Historical] Returned historical data for ${historicalData.totalTokens || 0} tokens in ${processingTime}ms`);
    
    return NextResponse.json(historicalData);
    
  } catch (error) {
    console.error('[Historical] Error:', error);
    
    return NextResponse.json({
      error: 'Failed to get historical data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { status: 500 });
  }
}