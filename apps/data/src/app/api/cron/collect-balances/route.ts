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
 * Collect balances for unified blob storage with balance series tracking
 */
async function collectBalancesForUnifiedStorage(): Promise<void> {
  try {
    console.log('[UnifiedBalanceCollector] Starting balance collection for unified storage...');
    
    // Load previous balance data for comparison
    let previousBalances: any = {};
    try {
      previousBalances = await unifiedBlobStorage.get('balances') || {};
      console.log(`[UnifiedBalanceCollector] Loaded previous balances for ${Object.keys(previousBalances).filter(k => k.match(/^S[PTM]/) ).length} addresses`);
    } catch (error) {
      console.log('[UnifiedBalanceCollector] No previous balances found, starting fresh');
    }
    
    // Get all known addresses from contracts and addresses sections
    const knownAddresses = new Set<string>();
    
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
        for (const [address] of Object.entries(addressesData)) {
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
    const balanceChanges: Array<{ address: string; changes: any }> = [];
    
    // Collect balance data for each address
    for (const address of addressList) {
      try {
        console.log(`[UnifiedBalanceCollector] Collecting balance for ${address}...`);
        
        const balanceData = await balanceService.getAddressBalances(address);
        const currentTimestamp = new Date().toISOString();
        
        // Create balance entry for the unified storage
        const balanceEntry = {
          address,
          lastUpdated: currentTimestamp,
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
        
        // Check for balance changes against previous data
        const previousBalance = previousBalances[address];
        if (previousBalance && typeof previousBalance === 'object') {
          const changes = detectBalanceChanges(previousBalance, balanceEntry);
          if (changes.hasChanges) {
            balanceChanges.push({
              address,
              changes: {
                timestamp: currentTimestamp,
                previousUpdate: previousBalance.lastUpdated,
                stxChanges: changes.stxChanges,
                tokenChanges: changes.tokenChanges,
                nftChanges: changes.nftChanges,
                summary: changes.summary
              }
            });
            console.log(`[UnifiedBalanceCollector] 📊 Detected changes for ${address}: ${changes.summary}`);
          }
        } else {
          // First time seeing this address
          balanceChanges.push({
            address,
            changes: {
              timestamp: currentTimestamp,
              previousUpdate: null,
              type: 'first_collection',
              summary: 'Initial balance collection',
              initialBalance: {
                stx: balanceEntry.stxBalance,
                tokenCount: balanceEntry.metadata.tokenCount,
                nftCount: balanceEntry.metadata.nftCount
              }
            }
          });
        }
        
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
    
    // Store balance changes in balance-series
    if (balanceChanges.length > 0) {
      await storeBalanceChanges(balanceChanges);
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
    
    for (const [_key, balance] of Object.entries(balancesBlob)) {
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
    
    // Write back 
    await unifiedBlobStorage.put('balances', balancesBlob);
    
    console.log(`[UnifiedBalanceCollector] Updated balances section with ${balanceUpdates.length} addresses, total STX: ${totalStxBalance}`);
    
  } catch (error) {
    console.error('[UnifiedBalanceCollector] Error:', error);
    throw error;
  }
}

/**
 * Detect changes between previous and current balance data
 */
function detectBalanceChanges(previous: any, current: any): {
  hasChanges: boolean;
  stxChanges: any;
  tokenChanges: any;
  nftChanges: any;
  summary: string;
} {
  const changes = {
    hasChanges: false,
    stxChanges: {} as any,
    tokenChanges: {} as Record<string, any>,
    nftChanges: {} as Record<string, any>,
    summary: ''
  };
  
  const summaryParts: string[] = [];
  
  // Check STX balance changes
  const prevStx = parseInt(previous.stxBalance || '0');
  const currStx = parseInt(current.stxBalance || '0');
  
  if (prevStx !== currStx) {
    changes.hasChanges = true;
    changes.stxChanges = {
      previous: prevStx.toString(),
      current: currStx.toString(),
      difference: (currStx - prevStx).toString(),
      percentChange: prevStx > 0 ? ((currStx - prevStx) / prevStx * 100).toFixed(2) : null
    };
    
    const stxDiff = (currStx - prevStx) / 1000000; // Convert to STX
    summaryParts.push(`STX: ${stxDiff > 0 ? '+' : ''}${stxDiff.toFixed(2)}`);
  }
  
  // Check fungible token changes
  const prevTokens = previous.fungibleTokens || {};
  const currTokens = current.fungibleTokens || {};
  const allTokens = new Set([...Object.keys(prevTokens), ...Object.keys(currTokens)]);
  
  for (const tokenId of allTokens) {
    const prevBalance = parseInt(prevTokens[tokenId]?.balance || '0');
    const currBalance = parseInt(currTokens[tokenId]?.balance || '0');
    
    if (prevBalance !== currBalance) {
      changes.hasChanges = true;
      changes.tokenChanges[tokenId] = {
        previous: prevBalance.toString(),
        current: currBalance.toString(),
        difference: (currBalance - prevBalance).toString()
      };
      
      const tokenSymbol = tokenId.split('.').pop() || tokenId.slice(-10);
      summaryParts.push(`${tokenSymbol}: ${currBalance - prevBalance > 0 ? '+' : ''}${currBalance - prevBalance}`);
    }
  }
  
  // Check NFT changes
  const prevNfts = previous.nonFungibleTokens || {};
  const currNfts = current.nonFungibleTokens || {};
  const allNfts = new Set([...Object.keys(prevNfts), ...Object.keys(currNfts)]);
  
  for (const nftId of allNfts) {
    const prevCount = parseInt(prevNfts[nftId]?.count || '0');
    const currCount = parseInt(currNfts[nftId]?.count || '0');
    
    if (prevCount !== currCount) {
      changes.hasChanges = true;
      changes.nftChanges[nftId] = {
        previous: prevCount.toString(),
        current: currCount.toString(),
        difference: (currCount - prevCount).toString()
      };
      
      const nftName = nftId.split('::').pop() || nftId.slice(-15);
      summaryParts.push(`${nftName} NFT: ${currCount - prevCount > 0 ? '+' : ''}${currCount - prevCount}`);
    }
  }
  
  changes.summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'No significant changes';
  
  return changes;
}

/**
 * Store balance changes in the balance-series section
 */
async function storeBalanceChanges(balanceChanges: Array<{ address: string; changes: any }>): Promise<void> {
  try {
    console.log(`[BalanceSeries] Storing ${balanceChanges.length} balance change records...`);
    
    // Group changes by timestamp (5-minute intervals for efficiency)
    const timestamp = new Date();
    const intervalKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}_${String(Math.floor(timestamp.getHours())).padStart(2, '0')}-${String(Math.floor(timestamp.getMinutes() / 5) * 5).padStart(2, '0')}`;
    
    // Load existing balance series data for this interval
    let seriesData: any = {};
    try {
      seriesData = await unifiedBlobStorage.get(`balance-series/${intervalKey}`) || {};
    } catch (error) {
      // No existing data for this interval
      seriesData = {
        timestamp: timestamp.toISOString(),
        interval: intervalKey,
        intervalStart: new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), Math.floor(timestamp.getHours()), Math.floor(timestamp.getMinutes() / 5) * 5).toISOString(),
        source: 'unified-balance-collector',
        changes: {}
      };
    }
    
    // Add new changes to the series data
    for (const change of balanceChanges) {
      seriesData.changes[change.address] = change.changes;
    }
    
    // Update metadata
    seriesData.lastUpdated = timestamp.toISOString();
    seriesData.changeCount = Object.keys(seriesData.changes).length;
    
    // Store the series data
    await unifiedBlobStorage.put(`balance-series/${intervalKey}`, seriesData);
    
    console.log(`[BalanceSeries] ✓ Stored balance changes for interval ${intervalKey} with ${balanceChanges.length} new changes`);
    
  } catch (error) {
    console.error('[BalanceSeries] Error storing balance changes:', error);
    throw error;
  }
}