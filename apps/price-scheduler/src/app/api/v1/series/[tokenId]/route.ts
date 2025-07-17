import { NextResponse } from 'next/server';

const DEX_CACHE_BASE_URL = process.env.DEX_CACHE_BASE_URL || 'https://dex-cache.charisma.rocks';

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

interface RouteParams {
  tokenId: string;
}

export async function GET(
  request: Request,
  { params }: { params: RouteParams }
) {
  const startTime = Date.now();
  
  try {
    const { tokenId } = params;
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

    // Fetch token details from dex-cache API
    const dexCacheUrl = `${DEX_CACHE_BASE_URL}/api/v1/prices/${encodeURIComponent(tokenId)}?details=${includeDetails}`;
    
    const response = await fetch(dexCacheUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'price-scheduler-series/1.0'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({
          status: 'error',
          error: 'Token not found',
          message: `Token with ID ${tokenId} not found`
        }, {
          status: 404,
          headers
        });
      }
      throw new Error(`DEX Cache API error: ${response.status} ${response.statusText}`);
    }

    const dexData = await response.json();

    if (dexData.status !== 'success') {
      throw new Error(`DEX Cache API returned error: ${dexData.error}`);
    }

    const tokenData = dexData.data;

    // For now, we'll generate mock time series data based on current price
    // In a real implementation, this would fetch historical data from blob storage
    const mockTimeSeriesData = generateMockTimeSeries(tokenData, timeframe, parseInt(limit));

    const processingTime = Date.now() - startTime;
    
    console.log(`[Series API] Generated ${mockTimeSeriesData.length} data points for ${tokenData.symbol} in ${processingTime}ms`);

    return NextResponse.json({
      status: 'success',
      data: {
        tokenId: tokenData.tokenId,
        symbol: tokenData.symbol,
        name: tokenData.name,
        image: tokenData.image,
        currentPrice: tokenData.usdPrice,
        confidence: tokenData.confidence,
        totalLiquidity: tokenData.totalLiquidity,
        isLpToken: tokenData.isLpToken || false,
        nestLevel: tokenData.nestLevel || 0,
        priceSource: tokenData.calculationDetails?.priceSource || 'unknown',
        isArbitrageOpportunity: tokenData.isArbitrageOpportunity || false,
        priceDeviation: tokenData.priceDeviation || 0,
        series: mockTimeSeriesData,
        // Include detailed path information if available
        primaryPath: tokenData.primaryPath || null,
        alternativePaths: tokenData.alternativePaths || [],
        calculationDetails: tokenData.calculationDetails || null
      },
      metadata: {
        timeframe,
        dataPoints: mockTimeSeriesData.length,
        processingTimeMs: processingTime,
        includeDetails
      }
    }, {
      status: 200,
      headers
    });

  } catch (error: any) {
    console.error(`[Series API] Error fetching series data for ${params.tokenId}:`, error);
    
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

// Generate mock time series data based on current price
function generateMockTimeSeries(tokenData: any, timeframe: string, limit: number) {
  const now = Date.now();
  const series = [];
  
  // Define timeframe intervals in milliseconds
  const intervals = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000
  };
  
  const interval = intervals[timeframe as keyof typeof intervals] || intervals['1h'];
  const basePrice = tokenData.usdPrice || 0;
  
  // Generate historical data points
  for (let i = limit - 1; i >= 0; i--) {
    const timestamp = now - (i * interval);
    
    // Add some realistic price variation based on confidence
    const variation = (1 - tokenData.confidence) * 0.1; // Lower confidence = more variation
    const priceMultiplier = 1 + (Math.random() - 0.5) * variation;
    const price = basePrice * priceMultiplier;
    
    // Add some trend based on arbitrage opportunities
    const trend = tokenData.isArbitrageOpportunity ? 
      (Math.random() > 0.5 ? 1.02 : 0.98) : 1; // 2% trend for arbitrage tokens
    
    const finalPrice = price * Math.pow(trend, i / limit);
    
    series.push({
      timestamp,
      time: timestamp, // For chart compatibility
      value: finalPrice,
      usdPrice: finalPrice,
      confidence: tokenData.confidence + (Math.random() - 0.5) * 0.1,
      volume: Math.random() * 1000000, // Mock volume
      liquidity: tokenData.totalLiquidity * (0.8 + Math.random() * 0.4) // Vary liquidity
    });
  }
  
  return series;
}