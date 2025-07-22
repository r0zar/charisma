import { NextRequest, NextResponse } from 'next/server';
import { historicalBalanceService } from '@/services/historical-balance-service';
import { generateCacheHeaders } from '@/lib/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/v1/addresses/[address]/historical/[timeframe] - Get specific timeframe historical data
 * 
 * Query parameters:
 * - limit: max number of data points (default: 100)
 * 
 * This endpoint exactly matches the blob storage structure: addresses/<address>/historical/<timeframe>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string; timeframe: string }> }
) {
  const startTime = Date.now();

  try {
    const { address, timeframe } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');

    console.log('[Address Timeframe API] Request:', { address, timeframe, limit });

    // Validate timeframe
    if (!['5m', '1h', '1d'].includes(timeframe)) {
      return NextResponse.json(
        {
          error: 'Invalid timeframe',
          message: 'Timeframe must be one of: 5m, 1h, 1d',
          validTimeframes: ['5m', '1h', '1d'],
          requestedTimeframe: timeframe
        },
        { status: 400 }
      );
    }

    // Validate address format (basic validation)
    if (!address.startsWith('SP') && !address.startsWith('ST') && !address.startsWith('SM')) {
      return NextResponse.json(
        {
          error: 'Invalid address format',
          message: 'Address must be a valid Stacks address (SP*, ST*, or SM*)',
          address
        },
        { status: 400 }
      );
    }

    console.log(`[Address Timeframe API] Fetching ${timeframe} data for ${address}`);
    
    const data = await historicalBalanceService.getHistoricalBalances(address, timeframe, limit);
    
    if (!data) {
      return NextResponse.json(
        {
          error: 'Historical balance data not found',
          address,
          timeframe,
          message: `No ${timeframe} historical balance data available for this address`,
          blobPath: `addresses/${address}/historical/${timeframe}`,
          suggestion: 'Data may not have been collected yet. Check back after the next collection cycle.'
        },
        { status: 404 }
      );
    }

    // Add metadata about the data structure
    const enrichedData = {
      ...data,
      metadata: {
        blobPath: `addresses/${address}/historical/${timeframe}`,
        collectionInterval: timeframe === '5m' ? '5 minutes' : timeframe === '1h' ? '1 hour' : '1 day',
        aggregatedFrom: timeframe === '1h' ? '5m data' : timeframe === '1d' ? '1h data' : 'live collection'
      }
    };

    // Generate cache headers (shorter cache for historical data)
    const cacheHeaders = generateCacheHeaders(
      { sMaxAge: 180, staleWhileRevalidate: 600, browserCache: 60 }, // 3 minutes
      { deploymentId: process.env.VERCEL_DEPLOYMENT_ID }
    );

    const processingTime = Date.now() - startTime;
    cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
    cacheHeaders.set('X-Timeframe', timeframe);
    cacheHeaders.set('X-Address', address);
    cacheHeaders.set('X-Data-Points', data.dataPoints.toString());
    cacheHeaders.set('X-Blob-Path', `addresses/${address}/historical/${timeframe}`);

    console.log(`[Address Timeframe API] Returning ${data.dataPoints} ${timeframe} data points for ${address} in ${processingTime}ms`);

    return NextResponse.json(enrichedData, { headers: cacheHeaders });

  } catch (error) {
    console.error('[Address Timeframe API] Unexpected error:', error);

    const { address, timeframe } = await params;
    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to fetch historical balance data',
        address,
        timeframe,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`
      },
      { status: 500 }
    );
  }
}