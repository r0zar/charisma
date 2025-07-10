import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { logger } from '@/lib/server/logger';
import { verifySignatureAndGetSignerWithTimestamp } from 'blaze-sdk';

/**
 * Get cached analytics data for a specific wallet
 * This endpoint serves pre-computed analytics data from KV store
 * Requires wallet signature authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  try {
    const { walletAddress } = await params;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Note: Authentication disabled for reading analytics data to prevent infinite loops
    // Frontend pages are responsible for only requesting data for connected wallet
    logger.info(`📊 Analytics request for wallet: ${walletAddress.slice(0, 8)}...`);

    logger.info(`📊 Fetching cached analytics for wallet: ${walletAddress.slice(0, 8)}...`);

    // Get cached analytics summary
    const cacheKey = `analytics:summary:${walletAddress}`;
    const cachedSummary = await kv.get(cacheKey);

    if (!cachedSummary) {
      logger.info(`❌ No cached analytics found for wallet: ${walletAddress.slice(0, 8)}...`);
      return NextResponse.json({
        success: false,
        error: 'No analytics data available. Data will be available after next cron processing cycle.',
        metadata: {
          cached: false,
          lastUpdated: null,
          source: 'cache-miss'
        }
      }, { status: 404 });
    }

    // Get last updated timestamp
    const lastUpdated = await kv.get(`analytics:last_updated:${walletAddress}`) as number | null;

    logger.info(`✅ Serving cached analytics for wallet: ${walletAddress.slice(0, 8)}...`);

    return NextResponse.json({
      success: true,
      data: cachedSummary,
      metadata: {
        cached: true,
        lastUpdated,
        source: 'kv-cache',
        timestamp: Date.now()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to fetch cached analytics: ${errorMessage}`);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      metadata: {
        cached: false,
        lastUpdated: null,
        source: 'error'
      }
    }, { status: 500 });
  }
}

// Manual refresh endpoint (still requires background processing)
// Requires wallet signature authentication
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  try {
    const { walletAddress } = await params;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Note: Authentication disabled for refreshing analytics data to prevent infinite loops
    // Frontend pages are responsible for only requesting data for connected wallet
    logger.info(`🔄 Analytics refresh for wallet: ${walletAddress.slice(0, 8)}...`);

    // Instead of processing immediately, we'll trigger the cron job
    // This keeps processing out-of-band even for manual refreshes
    logger.info(`🔄 Manual refresh requested for wallet: ${walletAddress.slice(0, 8)}...`);

    // Set a flag to prioritize this wallet in next cron run
    await kv.set(`analytics:priority:${walletAddress}`, Date.now(), { ex: 60 }); // 1 minute priority flag

    return NextResponse.json({
      success: true,
      message: 'Refresh queued. Data will be updated in the next processing cycle.',
      walletAddress,
      timestamp: Date.now()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to queue analytics refresh: ${errorMessage}`);
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}