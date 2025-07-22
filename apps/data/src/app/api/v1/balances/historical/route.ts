import { NextRequest, NextResponse } from 'next/server';
import { historicalBalanceService } from '@/services/historical-balance-service';
import { generateCacheHeaders } from '@/lib/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/v1/balances/historical - Get historical balance data
 * 
 * Query parameters:
 * - address: specific address
 * - timeframe: 5m, 1h, 1d (default: 5m)
 * - limit: max number of data points (default: 100)
 * - addresses: comma-separated list of addresses for bulk fetch
 * 
 * Note: Historical balance data is now stored at addresses/<address>/historical/<timeframe>
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    const timeframe = url.searchParams.get('timeframe') || '5m';
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const addressesParam = url.searchParams.get('addresses');

    console.log('[Historical Balances API] Request:', { address, timeframe, limit, addressesParam });

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

    let result: any;

    if (addressesParam) {
      // Bulk fetch for multiple addresses
      const addresses = addressesParam.split(',').map(a => a.trim()).filter(a => a.length > 0);
      
      if (addresses.length === 0) {
        return NextResponse.json(
          { error: 'No valid addresses provided' },
          { status: 400 }
        );
      }

      console.log(`[Historical Balances API] Fetching bulk data for ${addresses.length} addresses`);

      const bulkData: Record<string, any> = {};
      
      for (const addr of addresses) {
        try {
          const data = await historicalBalanceService.getHistoricalBalances(addr, timeframe, limit);
          if (data) {
            bulkData[addr] = data;
          }
        } catch (error) {
          console.warn(`[Historical Balances API] Failed to get data for ${addr}:`, error);
          bulkData[addr] = null;
        }
      }

      result = {
        timeframe,
        limit,
        addressCount: Object.keys(bulkData).length,
        data: bulkData
      };

    } else if (address) {
      // Single address fetch
      console.log(`[Historical Balances API] Fetching data for ${address}`);
      
      const data = await historicalBalanceService.getHistoricalBalances(address, timeframe, limit);
      
      if (!data) {
        return NextResponse.json(
          {
            error: 'Historical balance data not found',
            address,
            message: 'No historical balance data available for this address',
            timeframe
          },
          { status: 404 }
        );
      }

      result = data;

    } else {
      // List all available addresses with historical data
      console.log('[Historical Balances API] Listing available addresses');
      
      const availableAddresses = await historicalBalanceService.getAvailableAddresses(timeframe);
      const stats = await historicalBalanceService.getStats();

      result = {
        message: 'Available addresses with historical balance data',
        timeframe,
        availableAddresses,
        addressCount: availableAddresses.length,
        statistics: stats,
        dataStructure: {
          note: 'Historical balance data is stored at addresses/<address>/historical/<timeframe>',
          treePath: 'addresses → [address] → historical → [timeframe]'
        },
        usage: {
          examples: [
            `/api/v1/balances/historical?address=SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS&timeframe=5m&limit=50`,
            `/api/v1/balances/historical?addresses=SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS,SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G&timeframe=1h`,
            `/api/v1/balances/historical?timeframe=1d&limit=30`
          ]
        }
      };
    }

    // Generate cache headers (shorter cache for historical data)
    const cacheHeaders = generateCacheHeaders(
      { sMaxAge: 180, staleWhileRevalidate: 600, browserCache: 60 }, // 3 minutes
      { deploymentId: process.env.VERCEL_DEPLOYMENT_ID }
    );

    const processingTime = Date.now() - startTime;
    cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
    cacheHeaders.set('X-Timeframe', timeframe);
    
    if (address) {
      cacheHeaders.set('X-Address', address);
    } else if (addressesParam) {
      cacheHeaders.set('X-Address-Count', addressesParam.split(',').length.toString());
    }

    console.log(`[Historical Balances API] Response ready in ${processingTime}ms`);

    return NextResponse.json(result, { headers: cacheHeaders });

  } catch (error) {
    console.error('[Historical Balances API] Unexpected error:', error);

    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to fetch historical balances',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`
      },
      { status: 500 }
    );
  }
}