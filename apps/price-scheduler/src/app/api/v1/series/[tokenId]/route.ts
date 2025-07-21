import { NextRequest, NextResponse } from 'next/server';
import { PriceSeriesAPI, PriceSeriesStorage, TokenPriceData } from '@services/prices';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const startTime = Date.now();

  try {
    const { tokenId } = await params;
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || '1h';
    const limit = url.searchParams.get('limit') || '100';
    const includeDetails = url.searchParams.get('details') === 'true';

    if (!tokenId) {
      return NextResponse.json({
        status: 'error',
        error: 'Token ID is required'
      }, {
        status: 400,
        headers
      });
    }

    console.log(`[Series API] Fetching series data for token: ${tokenId}, timeframe: ${timeframe}`);

    // Get current price from internal price service
    const currentPriceResult = await priceAPI.getCurrentPrice(tokenId);

    if (!currentPriceResult.success) {
      return NextResponse.json({
        status: 'error',
        error: 'Token not found',
        message: currentPriceResult.error || `Token with ID ${tokenId} not found in price service`
      }, {
        status: 404,
        headers
      });
    }

    const tokenData = currentPriceResult.data as TokenPriceData;

    // Get historical data from price service
    let historicalData: any[] = [];
    try {
      const historyResult = await priceAPI.getPriceHistory({
        tokenId,
        timeframe: timeframe as any,
        limit: parseInt(limit)
      });

      if (historyResult.success && historyResult.data && historyResult.data.length > 0) {
        historicalData = historyResult.data.map((point: any) => ({
          timestamp: point.timestamp,
          time: point.timestamp,
          value: point.usdPrice || point.price,
          usdPrice: point.usdPrice || point.price,
          confidence: point.reliability || point.confidence || 0.9,
          volume: point.volume || 0,
          liquidity: point.liquidity || 0
        }));
      }
    } catch (error) {
      console.warn(`[Series API] Failed to get history for ${tokenId}:`, error);
    }

    // If no historical data available, return error
    if (historicalData.length === 0) {
      return NextResponse.json({
        status: 'error',
        message: 'No historical price data available for this token',
        data: null
      }, { status: 404 });
    }

    const processingTime = Date.now() - startTime;

    console.log(`[Series API] Generated ${historicalData.length} data points for ${tokenData!.symbol} in ${processingTime}ms`);

    return NextResponse.json({
      status: 'success',
      data: {
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
        // Include detailed path information if available
        primaryPath: tokenData.marketData?.primaryPath || null,
        alternativePaths: tokenData.marketData?.alternativePaths || [],
        calculationDetails: tokenData.marketData || tokenData.oracleData || tokenData.virtualData || null
      },
      metadata: {
        timeframe,
        dataPoints: historicalData.length,
        processingTimeMs: processingTime,
        includeDetails,
        cached: currentPriceResult.cached
      }
    }, {
      status: 200,
      headers
    });

  } catch (error: any) {
    console.error(`[Series API] Error fetching series data:`, error);

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


