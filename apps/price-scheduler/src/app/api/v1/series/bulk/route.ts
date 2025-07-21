import { NextResponse } from 'next/server';
import { PriceSeriesAPI, PriceSeriesStorage } from '@services/prices';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!BLOB_READ_WRITE_TOKEN) {
  throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
}

// Initialize price series components
const storage = new PriceSeriesStorage(BLOB_READ_WRITE_TOKEN);
const priceAPI = new PriceSeriesAPI(storage);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900'
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { tokenIds, timeframe = '1h', limit = 100, includeDetails = false } = body;

    if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
      return NextResponse.json({
        status: 'error',
        error: 'Token IDs array is required'
      }, {
        status: 400,
        headers
      });
    }

    if (tokenIds.length > 20) {
      return NextResponse.json({
        status: 'error',
        error: 'Maximum 20 tokens allowed per request'
      }, {
        status: 400,
        headers
      });
    }

    console.log(`[Series API] Fetching bulk series data for ${tokenIds.length} tokens, timeframe: ${timeframe}`);

    // Use internal price service API
    const bulkResult = await priceAPI.getBulkCurrentPrices({
      tokenIds,
      includeArbitrage: includeDetails
    });

    if (!bulkResult.success) {
      return NextResponse.json({
        status: 'error',
        error: 'Price service error',
        message: bulkResult.error || 'Failed to fetch bulk prices from price service',
        metadata: {
          requestedTokens: tokenIds.length,
          foundTokens: 0,
          processingTimeMs: Date.now() - startTime,
          cached: bulkResult.cached
        }
      }, {
        status: 503,
        headers
      });
    }

    const prices = bulkResult.data?.prices || {};
    const foundTokens = Object.keys(prices);
    
    if (foundTokens.length === 0) {
      return NextResponse.json({
        status: 'error',
        error: 'No tokens found',
        message: 'None of the requested tokens were found in the price service'
      }, {
        status: 404,
        headers
      });
    }

    // Generate series data for each token (fetch history in parallel)
    const seriesData: Record<string, any> = {};
    const seriesGenerationStart = Date.now();
    
    // Fetch all historical data in parallel
    const historyPromises = foundTokens.map(async (tokenId) => {
      const historyStart = Date.now();
      try {
        const historyResult = await priceAPI.getPriceHistory({
          tokenId,
          timeframe: timeframe as any,
          limit
        });
        const historyTime = Date.now() - historyStart;
        if (historyTime > 1000) {
          console.log(`[Series API] SLOW: History for ${tokenId} took ${historyTime}ms`);
        }
        
        if (historyResult.success && historyResult.data && historyResult.data.length > 0) {
          return {
            tokenId,
            data: historyResult.data.map((point: any) => ({
              timestamp: point.timestamp,
              time: point.timestamp,
              value: point.usdPrice || point.price,
              usdPrice: point.usdPrice || point.price,
              confidence: point.reliability || point.confidence || 0.9,
              volume: point.volume || 0,
              liquidity: point.liquidity || 0
            }))
          };
        }
        return { tokenId, data: null };
      } catch (error) {
        const historyTime = Date.now() - historyStart;
        console.warn(`[Series API] ERROR: History for ${tokenId} failed after ${historyTime}ms:`, error);
        return { tokenId, data: null };
      }
    });

    // Wait for all history calls to complete
    const historyResults = await Promise.all(historyPromises);
    const allHistoryTime = Date.now() - seriesGenerationStart;
    if (allHistoryTime > 1000) {
      console.log(`[Series API] SLOW: All parallel history calls completed in ${allHistoryTime}ms`);
    }
    
    // Create history lookup map
    const historyMap = new Map();
    historyResults.forEach(result => {
      historyMap.set(result.tokenId, result.data);
    });
    
    // Build series data for each token
    for (const tokenId of foundTokens) {
      const tokenStart = Date.now();
      const tokenData = prices[tokenId];
      
      // Get historical data from parallel fetch results
      let historicalData = historyMap.get(tokenId);

      // If no historical data, skip this token
      if (!historicalData || historicalData.length === 0) {
        console.warn(`[Bulk Series API] No historical data available for ${tokenData.symbol}`);
        continue;
      }
      
      seriesData[tokenId] = {
        tokenId,
        symbol: tokenData.symbol,
        name: tokenData.symbol,
        image: '',
        currentPrice: tokenData.usdPrice,
        confidence: tokenData.reliability || 0.9,
        totalLiquidity: tokenData.marketData?.totalLiquidity || 0,
        isLpToken: false,
        nestLevel: 0,
        priceSource: tokenData.source,
        isArbitrageOpportunity: !!tokenData.arbitrageOpportunity,
        priceDeviation: tokenData.arbitrageOpportunity?.deviation || 0,
        series: historicalData,
        // Include detailed information only if requested
        ...(includeDetails && {
          primaryPath: tokenData.marketData?.primaryPath || null,
          alternativePaths: tokenData.marketData?.alternativePaths || [],
          calculationDetails: tokenData.marketData || tokenData.oracleData || tokenData.virtualData || null
        })
      };
    }

    const processingTime = Date.now() - startTime;
    
    if (processingTime > 1000) {
      console.log(`[Series API] SLOW: Generated bulk series data for ${foundTokens.length} tokens in ${processingTime}ms`);
    }

    return NextResponse.json({
      status: 'success',
      data: seriesData,
      metadata: {
        requestedTokens: tokenIds.length,
        foundTokens: foundTokens.length,
        missingTokens: tokenIds.filter(id => !foundTokens.includes(id)),
        timeframe,
        dataPointsPerToken: limit,
        processingTimeMs: processingTime,
        includeDetails
      }
    }, {
      status: 200,
      headers
    });

  } catch (error: any) {
    console.error('[Series API] Error fetching bulk series data:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      status: 'error',
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      metadata: {
        processingTimeMs: processingTime
      }
    }, {
      status: 500,
      headers
    });
  }
}


