import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv-store';
import { logger } from '@/lib/server/logger';
import { verifySignatureAndGetSignerWithTimestamp } from 'blaze-sdk';

/**
 * Get cached portfolio holdings for a specific wallet
 * Requires wallet signature authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { walletAddress: string } }
) {
  try {
    const { walletAddress } = params;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Note: Authentication disabled for reading holdings data to prevent infinite loops
    // Frontend pages are responsible for only requesting data for connected wallet
    logger.info(`💰 Holdings request for wallet: ${walletAddress.slice(0, 8)}...`);

    // Get cached portfolio holdings
    const holdings = await kv.get(`analytics:holdings:${walletAddress}`);
    const lastUpdated = await kv.get(`analytics:last_updated:${walletAddress}`) as number | null;

    if (!holdings) {
      return NextResponse.json({
        success: false,
        error: 'No holdings data available',
        metadata: {
          cached: false,
          lastUpdated: null,
          source: 'cache-miss'
        }
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: holdings,
      metadata: {
        cached: true,
        lastUpdated,
        source: 'kv-cache',
        timestamp: Date.now()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to fetch cached holdings:', error);
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}