import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Get cached portfolio holdings for a specific wallet
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

    // Note: Authentication disabled for reading holdings data to prevent infinite loops
    // Frontend pages are responsible for only requesting data for connected wallet
    console.log(`💰 Holdings request for wallet: ${walletAddress.slice(0, 8)}...`);

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
    console.error(`Failed to fetch cached holdings: ${errorMessage}`);
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}