import { historicalBalanceService } from '@/lib/balances/historical-balance-service';
import { balanceService } from '@/lib/balances/balance-service';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * POST /api/cron/collect-balances - Cron endpoint for collecting historical balance data
 * 
 * This endpoint should be called every 5 minutes by a cron service to collect
 * current balances for known addresses and add them to the historical dataset.
 * 
 * Authentication: Uses cron secret for security
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron authentication (skip in dev)
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('Authorization');
      const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret';

      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[Balance Collection Cron] Unauthorized request');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[Balance Collection Cron] Starting balance collection...');

    // Collect current balances and add to historical data
    const result = await historicalBalanceService.collectCurrentBalances();
    
    // Also collect balances for unified blob storage
    await collectBalancesForUnifiedStorage();

    const processingTime = Date.now() - startTime;

    // Get collection statistics
    const stats = await historicalBalanceService.getStats();

    const response = {
      success: result.success,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      collection: {
        addressesCollected: result.collected,
        errors: result.errors,
        errorCount: result.errors.length
      },
      statistics: stats,
      nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
    };

    if (result.success) {
      console.log(`[Balance Collection Cron] Successfully collected balances for ${result.collected} addresses in ${processingTime}ms`);
    } else {
      console.error(`[Balance Collection Cron] Collection failed with ${result.errors.length} errors`);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Balance Collection Cron] Unexpected error:', error);

    const processingTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
        error: 'Balance collection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/collect-balances - Manual trigger for balance collection (for testing)
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

    console.log('[Balance Collection Cron] Manual trigger initiated...');

    // Directly call the collection logic
    const result = await historicalBalanceService.collectCurrentBalances();
    
    // Also collect balances for unified blob storage
    await collectBalancesForUnifiedStorage();
    const startTime = Date.now();
    const processingTime = Date.now() - startTime;
    const stats = await historicalBalanceService.getStats();

    const response = {
      success: result.success,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      collection: {
        addressesCollected: result.collected,
        errors: result.errors,
        errorCount: result.errors.length
      },
      statistics: stats,
      trigger: 'manual'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Balance Collection Cron] Manual trigger error:', error);

    return NextResponse.json(
      {
        error: 'Manual trigger failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Collect balances for unified blob storage
 */
async function collectBalancesForUnifiedStorage(): Promise<void> {
  try {
    console.log('[UnifiedBalanceCollector] Starting balance collection for unified storage...');
    
    // Get all known addresses from contracts and addresses sections
    let knownAddresses = new Set<string>();
    
    try {
      const contractsData = await unifiedBlobStorage.get('contracts');
      if (contractsData && typeof contractsData === 'object') {
        for (const [contractId, contract] of Object.entries(contractsData)) {
          if (typeof contract === 'object' && contract && 'contractAddress' in contract) {
            const address = (contract as any).contractAddress || contractId.split('.')[0];
            if (address && address.match(/^S[PTM]/)) {
              knownAddresses.add(address);
            }
          }
        }
      }
    } catch (error) {
      console.log('[UnifiedBalanceCollector] No contracts data found:', error);
    }
    
    try {
      const addressesData = await unifiedBlobStorage.get('addresses');
      if (addressesData && typeof addressesData === 'object') {
        for (const [address, _] of Object.entries(addressesData)) {
          if (address.match(/^S[PTM]/)) {
            knownAddresses.add(address);
          }
        }
      }
    } catch (error) {
      console.log('[UnifiedBalanceCollector] No addresses data found:', error);
    }
    
    console.log(`[UnifiedBalanceCollector] Found ${knownAddresses.size} unique addresses to collect balances for`);
    
    // Limit to reasonable batch size to avoid timeouts
    const addressList = Array.from(knownAddresses).slice(0, 10);
    const balanceUpdates: Array<{ path: string; data: any }> = [];
    
    // Collect balance data for each address
    for (const address of addressList) {
      try {
        console.log(`[UnifiedBalanceCollector] Collecting balance for ${address}...`);
        
        const balanceData = await balanceService.getAddressBalances(address);
        
        // Create balance entry for the unified storage
        const balanceEntry = {
          address,
          lastUpdated: new Date().toISOString(),
          source: 'unified-balance-collector',
          stxBalance: balanceData.stx?.balance || '0',
          fungibleTokens: balanceData.fungible_tokens || {},
          nonFungibleTokens: balanceData.non_fungible_tokens || {},
          metadata: {
            cacheSource: (balanceData as any).source || 'api',
            tokenCount: Object.keys(balanceData.fungible_tokens || {}).length,
            nftCount: Object.keys(balanceData.non_fungible_tokens || {}).length,
            stxLocked: balanceData.stx?.locked || '0',
            stxTotalSent: balanceData.stx?.total_sent || '0',
            stxTotalReceived: balanceData.stx?.total_received || '0'
          }
        };
        
        balanceUpdates.push({
          path: `balances/${address}`,
          data: balanceEntry
        });
        
        console.log(`[UnifiedBalanceCollector] ✓ Collected balance for ${address}`);
        
      } catch (error) {
        console.warn(`[UnifiedBalanceCollector] Failed to get balance for ${address}:`, error);
      }
    }
    
    // Batch update individual balance files
    if (balanceUpdates.length > 0) {
      await unifiedBlobStorage.putBatch(balanceUpdates);
      console.log(`[UnifiedBalanceCollector] Updated ${balanceUpdates.length} individual balance files`);
    }
    
    // Update the main balances section: read, merge, write
    let balancesBlob: any = {};
    try {
      balancesBlob = await unifiedBlobStorage.get('balances') || {};
    } catch (error) {
      console.log('[UnifiedBalanceCollector] No existing balances blob, creating new one');
      balancesBlob = {};
    }
    
    // Add each balance to the existing blob
    for (const update of balanceUpdates) {
      const address = update.path.replace('balances/', '');
      balancesBlob[address] = update.data;
    }
    
    // Update metadata
    balancesBlob.lastUpdated = new Date().toISOString();
    balancesBlob.source = `${balancesBlob.source || 'unknown'} + unified-balance-collector`;
    balancesBlob.addressCount = Object.keys(balancesBlob).filter(k => 
      !['lastUpdated', 'source', 'addressCount', 'totalStxBalance', 'totalTokenTypes'].includes(k)
    ).length;
    
    // Calculate aggregate stats
    let totalStxBalance = 0;
    const tokenTypes = new Set<string>();
    
    for (const [key, balance] of Object.entries(balancesBlob)) {
      if (typeof balance === 'object' && balance && 'stxBalance' in balance) {
        const stxBal = parseInt((balance as any).stxBalance) || 0;
        totalStxBalance += stxBal;
        
        if ((balance as any).fungibleTokens) {
          for (const tokenId of Object.keys((balance as any).fungibleTokens)) {
            tokenTypes.add(tokenId);
          }
        }
      }
    }
    
    balancesBlob.totalStxBalance = totalStxBalance.toString();
    balancesBlob.totalTokenTypes = tokenTypes.size;
    
    // Write back with allowFullReplace flag
    await unifiedBlobStorage.put('balances', balancesBlob, { allowFullReplace: true });
    
    console.log(`[UnifiedBalanceCollector] Updated balances section with ${balanceUpdates.length} addresses, total STX: ${totalStxBalance}`);
    
  } catch (error) {
    console.error('[UnifiedBalanceCollector] Error:', error);
    throw error;
  }
}