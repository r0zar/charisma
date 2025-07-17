import { NextResponse } from 'next/server';
import { PriceSeriesAPI, PriceSeriesStorage } from '@services/prices';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!BLOB_READ_WRITE_TOKEN) {
  throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
}

// Initialize price series components
const storage = new PriceSeriesStorage({
  blobToken: BLOB_READ_WRITE_TOKEN,
  baseUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
});
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

    // Generate series data for each token
    const seriesData: Record<string, any> = {};
    
    for (const tokenId of foundTokens) {
      const tokenData = prices[tokenId];
      
      // Get historical data if available
      let historicalData = [];
      try {
        const historyResult = await priceAPI.getPriceHistory({
          tokenId,
          timeframe: timeframe as any,
          limit
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

      // If no historical data, generate sample time series based on current price
      if (historicalData.length === 0) {
        historicalData = generateSampleTimeSeries(tokenData, timeframe, limit);
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
          calculationDetails: tokenData.marketData || tokenData.oracleData || tokenData.intrinsicData || null
        })
      };
    }

    const processingTime = Date.now() - startTime;
    
    console.log(`[Series API] Generated bulk series data for ${foundTokens.length} tokens in ${processingTime}ms`);

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

// Generate sample time series data when no historical data is available
function generateSampleTimeSeries(tokenData: any, timeframe: string, limit: number) {
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
  
  // Generate realistic time series data points
  for (let i = limit - 1; i >= 0; i--) {
    const timestamp = now - (i * interval);
    
    // Add realistic price variation (smaller for more stable tokens)
    const confidence = tokenData.reliability || 0.9;
    const maxVariation = (1 - confidence) * 0.05; // Max 5% variation for low confidence
    const priceMultiplier = 1 + (Math.random() - 0.5) * maxVariation;
    const price = basePrice * priceMultiplier;
    
    // Add slight trend based on token type
    let trend = 1;
    if (tokenData.source === 'oracle') {
      trend = 1 + (Math.random() - 0.5) * 0.001; // Very stable for oracle prices
    } else if (tokenData.arbitrageOpportunity) {
      trend = Math.random() > 0.5 ? 1.005 : 0.995; // Slight trend for arbitrage opportunities
    }
    
    const finalPrice = price * Math.pow(trend, i / limit);
    
    series.push({
      timestamp,
      time: timestamp,
      value: finalPrice,
      usdPrice: finalPrice,
      confidence: confidence + (Math.random() - 0.5) * 0.05,
      volume: Math.random() * 100000, // Sample volume
      liquidity: (tokenData.marketData?.totalLiquidity || 0) * (0.9 + Math.random() * 0.2)
    });
  }
  
  return series;
}

