import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';
import { generateCacheHeaders } from '@/lib/utils/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/v1/price-series/[contractId] - Get historical price series for a token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const startTime = Date.now();

  try {
    const { contractId } = await params;
    
    console.log(`[PriceSeries API] Getting price series for ${contractId}`);

    // Try to get price series data from unified blob storage
    try {
      const seriesData = await unifiedBlobStorage.get(`price-series/${contractId}`);
      
      if (seriesData && typeof seriesData === 'object') {
        // Generate cache headers for successful response
        const cacheHeaders = generateCacheHeaders(
          { sMaxAge: 600, staleWhileRevalidate: 1800, browserCache: 120 }, // Longer cache for historical data
          { deploymentId: process.env.VERCEL_DEPLOYMENT_ID }
        );

        const processingTime = Date.now() - startTime;
        cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
        cacheHeaders.set('X-Data-Source', 'unified-blob-series');
        cacheHeaders.set('X-Contract-Id', contractId);
        cacheHeaders.set('X-Data-Points', String((seriesData as any).dataPoints?.length || 0));

        console.log(`[PriceSeries API] Returning series data for ${contractId} in ${processingTime}ms`);

        return NextResponse.json(seriesData, { headers: cacheHeaders });
      }
    } catch (error) {
      console.log(`[PriceSeries API] Series data not found for ${contractId}:`, error);
    }

    // Series not found
    return NextResponse.json(
      {
        error: 'Price series not found',
        contractId,
        message: 'No price series data found in blob storage',
        timestamp: new Date().toISOString()
      },
      { status: 404 }
    );

  } catch (error) {
    console.error('[PriceSeries API] Unexpected error:', error);

    const { contractId } = await params;

    return NextResponse.json(
      {
        error: 'Failed to fetch price series',
        contractId,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}