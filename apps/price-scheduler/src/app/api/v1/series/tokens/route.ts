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

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const search = url.searchParams.get('search') || '';
    const includeDetails = url.searchParams.get('details') === 'true';

    console.log(`[Series API] Fetching tokens list with limit: ${limit}, search: ${search}`);

    // Use internal price service API
    const tokensResult = await priceAPI.getAllTokens();

    if (!tokensResult.success) {
      return NextResponse.json({
        status: 'error',
        error: 'Price service error',
        message: tokensResult.error || 'Failed to fetch tokens from price service',
        metadata: {
          count: 0,
          totalAvailable: 0,
          processingTimeMs: Date.now() - startTime,
          cached: tokensResult.cached
        }
      }, {
        status: 503,
        headers
      });
    }

    let tokens = tokensResult.data || [];

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      tokens = tokens.filter((token: any) => 
        token.symbol.toLowerCase().includes(searchLower) ||
        token.tokenId.toLowerCase().includes(searchLower)
      );
    }

    // Apply limit
    if (limit > 0) {
      tokens = tokens.slice(0, limit);
    }

    // Format response for series UI (matching existing interface)
    const formattedTokens = tokens.map((token: any) => ({
      tokenId: token.tokenId,
      symbol: token.symbol,
      name: token.symbol, // Use symbol as name fallback
      image: '', // Not available from internal service
      usdPrice: token.usdPrice,
      confidence: 0.9, // Default confidence for internal data
      totalLiquidity: 0, // Not available from getAllTokens
      isLpToken: false, // Could be enhanced later
      nestLevel: 0,
      priceSource: token.source,
      isArbitrageOpportunity: false, // Could be enhanced later
      priceDeviation: 0,
      lastUpdated: token.lastUpdated
    }));

    const processingTime = Date.now() - startTime;
    
    console.log(`[Series API] Returned ${formattedTokens.length} tokens in ${processingTime}ms`);

    return NextResponse.json({
      status: 'success',
      data: formattedTokens,
      metadata: {
        count: formattedTokens.length,
        totalAvailable: tokensResult.data?.length || 0,
        processingTimeMs: processingTime,
        search,
        includeDetails,
        cached: tokensResult.cached
      }
    }, {
      status: 200,
      headers
    });

  } catch (error: any) {
    console.error('[Series API] Error fetching tokens:', error);
    
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