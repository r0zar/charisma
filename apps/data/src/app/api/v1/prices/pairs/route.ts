import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * GET /api/v1/prices/pairs - Get trading pair data
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    
    console.log(`[Pairs] Getting pairs data (refresh: ${forceRefresh})`);
    
    // Get pairs data from blob storage
    const pricesBlob = await unifiedBlobStorage.get('prices');
    let pairsData = null;
    
    if (pricesBlob && typeof pricesBlob === 'object') {
      pairsData = (pricesBlob as any).pairs;
    }
    
    // If no pairs data exists or is empty object, create proper structure
    if (!pairsData || (typeof pairsData === 'object' && Object.keys(pairsData).length === 0)) {
      pairsData = {
        timestamp: Date.now(),
        pairs: {},
        pairCount: 0,
        source: 'empty-structure'
      };
      
      // Store the empty structure back to blob
      if (pricesBlob) {
        (pricesBlob as any).pairs = pairsData;
        await unifiedBlobStorage.put('prices', pricesBlob);
      }
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`[Pairs] Returned ${pairsData.pairCount || 0} pairs in ${processingTime}ms`);
    
    return NextResponse.json(pairsData);
    
  } catch (error) {
    console.error('[Pairs] Error:', error);
    
    return NextResponse.json({
      error: 'Failed to get pairs data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { status: 500 });
  }
}