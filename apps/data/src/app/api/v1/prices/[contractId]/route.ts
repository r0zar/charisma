import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';
import { generateCacheHeaders } from '@/lib/utils/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/v1/prices/[contractId] - Get individual token data from simplified structure
 * 
 * Returns complete token data including current price, historical data, and metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const startTime = Date.now();

  try {
    const { contractId } = await params;
    
    console.log(`[Token API] Getting token data for ${contractId}`);

    // Try to get token data from unified blob storage
    try {
      const tokenData = await unifiedBlobStorage.get(`prices/${contractId}`);
      
      if (tokenData && typeof tokenData === 'object') {
        // Generate cache headers for successful response
        const cacheHeaders = generateCacheHeaders(
          { sMaxAge: 300, staleWhileRevalidate: 900, browserCache: 60 },
          { deploymentId: process.env.VERCEL_DEPLOYMENT_ID }
        );

        const processingTime = Date.now() - startTime;
        cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
        cacheHeaders.set('X-Data-Source', 'unified-blob');
        cacheHeaders.set('X-Token-Id', contractId);

        console.log(`[Token API] Returning token data for ${contractId} in ${processingTime}ms`);

        return NextResponse.json(tokenData, { headers: cacheHeaders });
      }
    } catch (error) {
      console.log(`[Token API] Token data not found for ${contractId}:`, error);
    }

    // Token not found
    return NextResponse.json(
      {
        error: 'Token not found',
        contractId,
        message: 'No token data found in blob storage',
        timestamp: new Date().toISOString()
      },
      { status: 404 }
    );

  } catch (error) {
    console.error('[Token API] Unexpected error:', error);

    const { contractId } = await params;

    return NextResponse.json(
      {
        error: 'Failed to fetch token data',
        contractId,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}