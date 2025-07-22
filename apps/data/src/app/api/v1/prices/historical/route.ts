import { NextRequest, NextResponse } from 'next/server';
import { historicalPriceService } from '@/services/historical-price-service';
import { generateCacheHeaders } from '@/lib/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/v1/prices/historical - Get historical price data
 * 
 * Query parameters:
 * - token: specific token contract ID
 * - timeframe: 5m, 1h, 1d (default: 5m)
 * - limit: max number of data points (default: 100)
 * - tokens: comma-separated list of tokens for bulk fetch
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const tokenId = url.searchParams.get('token');
    const timeframe = url.searchParams.get('timeframe') || '5m';
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const tokensParam = url.searchParams.get('tokens');

    console.log('[Historical Prices API] Request:', { tokenId, timeframe, limit, tokensParam });

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

    if (tokensParam) {
      // Bulk fetch for multiple tokens
      const tokenIds = tokensParam.split(',').map(t => t.trim()).filter(t => t.length > 0);
      
      if (tokenIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid tokens provided' },
          { status: 400 }
        );
      }

      console.log(`[Historical Prices API] Fetching bulk data for ${tokenIds.length} tokens`);

      const bulkData: Record<string, any> = {};
      
      for (const token of tokenIds) {
        try {
          const data = await historicalPriceService.getHistoricalData(token, timeframe, limit);
          if (data) {
            bulkData[token] = data;
          }
        } catch (error) {
          console.warn(`[Historical Prices API] Failed to get data for ${token}:`, error);
          bulkData[token] = null;
        }
      }

      result = {
        timeframe,
        limit,
        tokenCount: Object.keys(bulkData).length,
        data: bulkData
      };

    } else if (tokenId) {
      // Single token fetch
      console.log(`[Historical Prices API] Fetching data for ${tokenId}`);
      
      const data = await historicalPriceService.getHistoricalData(tokenId, timeframe, limit);
      
      if (!data) {
        return NextResponse.json(
          {
            error: 'Historical data not found',
            tokenId,
            message: 'No historical price data available for this token',
            timeframe
          },
          { status: 404 }
        );
      }

      result = data;

    } else {
      // List all available tokens with historical data
      console.log('[Historical Prices API] Listing available tokens');
      
      const availableTokens = await historicalPriceService.getAvailableTokens(timeframe);
      const stats = await historicalPriceService.getStats();

      result = {
        message: 'Available tokens with historical data',
        timeframe,
        availableTokens,
        tokenCount: availableTokens.length,
        statistics: stats,
        usage: {
          examples: [
            `/api/v1/prices/historical?token=SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token&timeframe=5m&limit=50`,
            `/api/v1/prices/historical?tokens=SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token,SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token&timeframe=1h`,
            `/api/v1/prices/historical?timeframe=1d&limit=30`
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
    
    if (tokenId) {
      cacheHeaders.set('X-Token-Id', tokenId);
    } else if (tokensParam) {
      cacheHeaders.set('X-Token-Count', tokensParam.split(',').length.toString());
    }

    console.log(`[Historical Prices API] Response ready in ${processingTime}ms`);

    return NextResponse.json(result, { headers: cacheHeaders });

  } catch (error) {
    console.error('[Historical Prices API] Unexpected error:', error);

    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to fetch historical prices',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`
      },
      { status: 500 }
    );
  }
}