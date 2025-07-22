import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * GET /api/v1/prices/lookup/[symbol] - Lookup contract ID by symbol and redirect to token data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    
    console.log(`[Lookup API] Looking up symbol: ${symbol}`);

    // Get all prices to find the contract ID for this symbol
    try {
      const pricesData = await unifiedBlobStorage.get('prices');
      
      if (pricesData && typeof pricesData === 'object') {
        // Look for a token with matching symbol
        for (const [contractId, tokenData] of Object.entries(pricesData)) {
          // Skip metadata fields
          if (contractId === 'lastUpdated' || contractId === 'source' || contractId === 'tokenCount') {
            continue;
          }
          
          if (typeof tokenData === 'object' && tokenData !== null) {
            const metadata = (tokenData as any).metadata;
            if (metadata && metadata.symbol === symbol.toUpperCase()) {
              // Found matching token, return its data
              return NextResponse.json({
                contractId,
                symbol: metadata.symbol,
                name: metadata.name,
                tokenData,
                found: true
              });
            }
          }
        }
      }
    } catch (error) {
      console.log(`[Lookup API] Error accessing prices data:`, error);
    }

    // Symbol not found
    return NextResponse.json(
      {
        error: 'Symbol not found',
        symbol: symbol.toUpperCase(),
        message: 'No token found with this symbol',
        found: false,
        timestamp: new Date().toISOString()
      },
      { status: 404 }
    );

  } catch (error) {
    console.error('[Lookup API] Unexpected error:', error);

    return NextResponse.json(
      {
        error: 'Failed to lookup symbol',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}