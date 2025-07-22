import { NextRequest, NextResponse } from 'next/server';
import { historicalPriceService } from '@/services/historical-price-service';

export const runtime = 'edge';

/**
 * POST /api/cron/collect-prices - Cron endpoint for collecting historical price data
 * 
 * This endpoint should be called every 5 minutes by a cron service (Vercel Cron, GitHub Actions, etc.)
 * to collect current prices and add them to the historical dataset.
 * 
 * Authentication: Uses cron secret for security
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron authentication
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Price Collection Cron] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Price Collection Cron] Starting price collection...');

    // Collect current prices and add to historical data
    const result = await historicalPriceService.collectCurrentPrices();
    
    const processingTime = Date.now() - startTime;
    
    // Get collection statistics
    const stats = await historicalPriceService.getStats();

    const response = {
      success: result.success,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      collection: {
        pricesCollected: result.collected,
        errors: result.errors,
        errorCount: result.errors.length
      },
      statistics: stats,
      nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
    };

    if (result.success) {
      console.log(`[Price Collection Cron] Successfully collected ${result.collected} prices in ${processingTime}ms`);
    } else {
      console.error(`[Price Collection Cron] Collection failed with ${result.errors.length} errors`);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Price Collection Cron] Unexpected error:', error);

    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
        error: 'Price collection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/collect-prices - Manual trigger for price collection (for testing)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret';
    
    if (secret !== cronSecret) {
      return NextResponse.json(
        { error: 'Secret required for manual trigger' },
        { status: 401 }
      );
    }

    console.log('[Price Collection Cron] Manual trigger initiated...');

    // Directly call the collection logic
    const result = await historicalPriceService.collectCurrentPrices();
    const startTime = Date.now();
    const processingTime = Date.now() - startTime;
    const stats = await historicalPriceService.getStats();

    const response = {
      success: result.success,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      collection: {
        pricesCollected: result.collected,
        errors: result.errors,
        errorCount: result.errors.length
      },
      statistics: stats,
      trigger: 'manual'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Price Collection Cron] Manual trigger error:', error);
    
    return NextResponse.json(
      {
        error: 'Manual trigger failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}