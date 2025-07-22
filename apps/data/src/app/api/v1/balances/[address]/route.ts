import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';
import { balanceService } from '@/lib/balances/balance-service';
import { generateCacheHeaders, getCachePolicy } from '@/lib/utils/cache-strategy';

export const runtime = 'edge';

/**
 * GET /api/v1/balances/[address] - Get balance data for a specific address
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const startTime = Date.now();
  const address = params.address;

  try {
    console.log(`[Balances API] Getting balance for address: ${address}`);

    // Validate address format
    if (!address || !address.match(/^S[PTM][0-9A-Z]{39}$/)) {
      return NextResponse.json(
        { error: 'Invalid Stacks address format' },
        { status: 400 }
      );
    }

    // Try to get balance from unified storage first
    let balanceData;
    let isRealTimeFetch = false;
    
    try {
      balanceData = await unifiedBlobStorage.get(`balances/${address}`);
      console.log(`[Balances API] Found cached balance for ${address}`);
    } catch (error) {
      console.log(`[Balances API] No cached balance for ${address}, fetching real-time...`);
      isRealTimeFetch = true;
      
      // Fetch real-time balance data
      try {
        const realTimeBalance = await balanceService.getAddressBalances(address);
        
        // Create balance entry for unified storage
        const balanceEntry = {
          address,
          lastUpdated: new Date().toISOString(),
          source: 'real-time-api-fetch',
          stxBalance: realTimeBalance.stx?.balance || '0',
          fungibleTokens: realTimeBalance.fungible_tokens || {},
          nonFungibleTokens: realTimeBalance.non_fungible_tokens || {},
          metadata: {
            cacheSource: (realTimeBalance as any).source || 'api',
            tokenCount: Object.keys(realTimeBalance.fungible_tokens || {}).length,
            nftCount: Object.keys(realTimeBalance.non_fungible_tokens || {}).length,
            stxLocked: realTimeBalance.stx?.locked || '0',
            stxTotalSent: realTimeBalance.stx?.total_sent || '0',
            stxTotalReceived: realTimeBalance.stx?.total_received || '0'
          }
        };
        
        // Cache the balance data for future requests
        try {
          await unifiedBlobStorage.put(`balances/${address}`, balanceEntry);
          console.log(`[Balances API] Cached balance data for ${address}`);
          
          // Also try to update the main balances section
          try {
            let balancesBlob: any = {};
            try {
              balancesBlob = await unifiedBlobStorage.get('balances') || {};
            } catch (e) {
              balancesBlob = {};
            }
            
            // Add this address to the main blob
            balancesBlob[address] = balanceEntry;
            balancesBlob.lastUpdated = new Date().toISOString();
            balancesBlob.source = `${balancesBlob.source || 'unknown'} + real-time-fetch`;
            balancesBlob.addressCount = Object.keys(balancesBlob).filter(k => 
              !['lastUpdated', 'source', 'addressCount', 'totalStxBalance', 'totalTokenTypes'].includes(k)
            ).length;
            
            await unifiedBlobStorage.put('balances', balancesBlob, { allowFullReplace: true });
          } catch (mainBlobError) {
            console.warn(`[Balances API] Failed to update main balances blob:`, mainBlobError);
            // Continue anyway - we have the individual balance
          }
          
        } catch (cacheError) {
          console.warn(`[Balances API] Failed to cache balance for ${address}:`, cacheError);
          // Continue anyway - we have the balance data
        }
        
        balanceData = balanceEntry;
        
      } catch (fetchError) {
        console.error(`[Balances API] Failed to fetch real-time balance for ${address}:`, fetchError);
        return NextResponse.json(
          { 
            error: 'Failed to fetch balance data',
            message: fetchError instanceof Error ? fetchError.message : 'Unable to fetch balance data',
            address
          },
          { status: 500 }
        );
      }
    }

    // Generate cache headers
    const cachePolicy = getCachePolicy(['balances', address], false);
    const cacheHeaders = generateCacheHeaders(cachePolicy, {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID
    });

    const processingTime = Date.now() - startTime;
    cacheHeaders.set('X-Response-Time', `${processingTime}ms`);
    cacheHeaders.set('X-Address', address);

    console.log(`[Balances API] Returning balance for ${address} in ${processingTime}ms`);

    return NextResponse.json(
      {
        address,
        balance: balanceData,
        meta: {
          timestamp: new Date().toISOString(),
          processingTime: `${processingTime}ms`,
          source: isRealTimeFetch ? 'real-time-fetch-and-cache' : 'cached-data',
          cached: !isRealTimeFetch
        }
      },
      { headers: cacheHeaders }
    );

  } catch (error) {
    console.error(`[Balances API] Error for ${address}:`, error);

    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        error: 'Failed to get balance data',
        message: error instanceof Error ? error.message : 'Unknown error',
        address,
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`
      },
      { status: 500 }
    );
  }
}