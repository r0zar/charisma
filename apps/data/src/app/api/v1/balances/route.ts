import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';
import { generateCacheHeaders, getCachePolicy } from '@/lib/utils/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/v1/balances - Get all balances data and metadata
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    console.log('[Balances API] Getting balances data...');

    // Get balances from unified storage
    const balancesData = await unifiedBlobStorage.get('balances');
    
    if (!balancesData || typeof balancesData !== 'object') {
      return NextResponse.json(
        { 
          error: 'Balances data not available',
          message: 'The balances section has not been initialized yet. Try running the balance collector first.'
        },
        { status: 404 }
      );
    }

    // Extract metadata and address entries
    const { lastUpdated, source, addressCount, totalStxBalance, totalTokenTypes, ...addressEntries } = balancesData as any;
    
    // Get address list with pagination
    const addressList = Object.keys(addressEntries).slice(offset, offset + limit);
    const paginatedBalances: any = {};
    
    for (const address of addressList) {
      paginatedBalances[address] = addressEntries[address];
    }

    // Calculate real-time stats
    let calculatedStxBalance = 0;
    const calculatedTokenTypes = new Set<string>();
    
    for (const [address, balance] of Object.entries(addressEntries)) {
      if (typeof balance === 'object' && balance && 'stxBalance' in balance) {
        const stxBal = parseInt((balance as any).stxBalance) || 0;
        calculatedStxBalance += stxBal;
        
        if ((balance as any).fungibleTokens) {
          for (const tokenId of Object.keys((balance as any).fungibleTokens)) {
            calculatedTokenTypes.add(tokenId);
          }
        }
      }
    }

    // Generate cache headers
    const cachePolicy = getCachePolicy(['balances'], false);
    const cacheHeaders = generateCacheHeaders(cachePolicy, {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID
    });

    const processingTime = Date.now() - startTime;
    cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
    cacheHeaders.set('X-Address-Count', Object.keys(addressEntries).length.toString());

    const result = {
      metadata: {
        lastUpdated,
        source,
        addressCount: Object.keys(addressEntries).length,
        totalStxBalance: calculatedStxBalance.toString(),
        totalTokenTypes: calculatedTokenTypes.size,
        // Include stored metadata for comparison
        stored: {
          addressCount,
          totalStxBalance,
          totalTokenTypes
        }
      },
      pagination: {
        limit,
        offset,
        total: Object.keys(addressEntries).length,
        hasMore: offset + limit < Object.keys(addressEntries).length
      },
      balances: paginatedBalances,
      endpoints: {
        singleAddress: '/api/v1/balances/{address}',
        historical: '/api/v1/balances/historical',
        knownAddresses: '/api/v1/balances/known-addresses'
      }
    };

    console.log(`[Balances API] Returning ${addressList.length} balances (${Object.keys(addressEntries).length} total) in ${processingTime}ms`);

    return NextResponse.json(result, { headers: cacheHeaders });

  } catch (error) {
    console.error('[Balances API] Error:', error);

    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to get balances data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`
      },
      { status: 500 }
    );
  }
}