import { NextRequest, NextResponse } from 'next/server';
import { historicalBalanceService } from '@/lib/balances/historical-balance-service';
import { generateCacheHeaders } from '@/lib/utils/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/v1/addresses/[address]/historical - Get historical balance data for a specific address
 * 
 * Query parameters:
 * - timeframe: 5m, 1h, 1d (default: 5m)
 * - limit: max number of data points (default: 100)
 * 
 * This endpoint follows the nested structure: addresses/<address>/historical/<timeframe>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const startTime = Date.now();

  try {
    const { address } = await params;
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || '5m';
    const limit = parseInt(url.searchParams.get('limit') || '100');

    console.log('[Address Historical API] Request:', { address, timeframe, limit });

    // Validate timeframe
    if (!['5m', '1h', '1d'].includes(timeframe)) {
      return NextResponse.json(
        {
          error: 'Invalid timeframe',
          message: 'Timeframe must be one of: 5m, 1h, 1d',
          validTimeframes: ['5m', '1h', '1d']
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

    console.log(`[Address Historical API] Fetching historical data for ${address}`);
    
    const data = await historicalBalanceService.getHistoricalBalances(address, timeframe, limit);
    
    if (!data) {
      return NextResponse.json(
        {
          error: 'Historical balance data not found',
          address,
          timeframe,
          message: 'No historical balance data available for this address',
          dataPath: `addresses/${address}/historical/${timeframe}`
        },
        { status: 404 }
      );
    }

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

    console.log(`[Address Historical API] Returning ${data.dataPoints} data points for ${address} in ${processingTime}ms`);

    return NextResponse.json(data, { headers: cacheHeaders });

  } catch (error) {
    console.error('[Address Historical API] Unexpected error:', error);

    const { address } = await params;
    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to fetch historical balance data',
        address,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`
      },
      { status: 500 }
    );
  }
}