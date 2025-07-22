import { NextRequest, NextResponse } from 'next/server';
import { simplePriceService } from '@/lib/prices/simple-price-service';

export const runtime = 'edge';

/**
 * Simple prices/current endpoint
 * GET /api/v1/prices/current - Get current token prices
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    
    console.log(`[Prices] Getting current prices (refresh: ${forceRefresh})`);
    
    // Get current prices from simple service
    const prices = await simplePriceService.getCurrentPrices(forceRefresh);
    
    const processingTime = Date.now() - startTime;
    console.log(`[Prices] Returned ${Object.keys(prices).length} prices in ${processingTime}ms`);
    
    // Return the same structure as stored in blob for UI consistency
    const response = {
      timestamp: Date.now(),
      prices,
      tokenCount: Object.keys(prices).length,
      source: forceRefresh ? 'simple-service-refresh' : 'simple-service-cached'
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[Prices] Error:', error);
    
    return NextResponse.json({
      error: 'Failed to get current prices',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { status: 500 });
  }
}