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

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '100';
    const search = url.searchParams.get('search') || '';
    const includeDetails = url.searchParams.get('details') === 'true';

    console.log(`[Series API] Fetching tokens list with limit: ${limit}, search: ${search}`);

    // Fetch tokens from dex-cache API
    const dexCacheUrl = `${DEX_CACHE_BASE_URL}/api/v1/prices?limit=${limit}&details=${includeDetails}`;
    
    const response = await fetch(dexCacheUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'price-scheduler-series/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`DEX Cache API error: ${response.status} ${response.statusText}`);
    }

    const dexData = await response.json();

    if (dexData.status !== 'success') {
      throw new Error(`DEX Cache API returned error: ${dexData.error}`);
    }

    // Process and filter tokens
    let tokens = dexData.data || [];

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      tokens = tokens.filter((token: any) => 
        token.symbol.toLowerCase().includes(searchLower) ||
        token.name.toLowerCase().includes(searchLower) ||
        token.tokenId.toLowerCase().includes(searchLower)
      );
    }

    // Sort tokens by confidence and liquidity
    tokens.sort((a: any, b: any) => {
      // Prioritize by confidence first, then by liquidity
      const confDiff = b.confidence - a.confidence;
      if (Math.abs(confDiff) > 0.1) return confDiff;
      return b.totalLiquidity - a.totalLiquidity;
    });

    // Format response for series UI
    const formattedTokens = tokens.map((token: any) => ({
      tokenId: token.tokenId,
      symbol: token.symbol,
      name: token.name,
      image: token.image,
      usdPrice: token.usdPrice,
      confidence: token.confidence,
      totalLiquidity: token.totalLiquidity,
      isLpToken: token.isLpToken || false,
      nestLevel: token.nestLevel || 0,
      priceSource: token.calculationDetails?.priceSource || 'unknown',
      isArbitrageOpportunity: token.isArbitrageOpportunity || false,
      priceDeviation: token.priceDeviation || 0,
      lastUpdated: token.lastUpdated
    }));

    const processingTime = Date.now() - startTime;
    
    console.log(`[Series API] Returned ${formattedTokens.length} tokens in ${processingTime}ms`);

    return NextResponse.json({
      status: 'success',
      data: formattedTokens,
      metadata: {
        count: formattedTokens.length,
        totalAvailable: dexData.metadata?.totalTokensAvailable || 0,
        processingTimeMs: processingTime,
        search,
        includeDetails
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