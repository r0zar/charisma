import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Migrate data from discovered section to main contracts and addresses sections
 * GET /api/cron/migrate-discovered-data
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[MigrateDiscovered] Starting migration from discovered to main sections...');

    // Get discovered data
    const discoveredData = await unifiedBlobStorage.get('discovered');
    
    if (!discoveredData || typeof discoveredData !== 'object') {
      return NextResponse.json({
        success: false,
        message: 'No discovered data found to migrate'
      });
    }

    let totalContractsMigrated = 0;
    let totalAddressesMigrated = 0;
    const updates: Array<{ path: string; data: any }> = [];

    // Process each discovery source
    for (const [sourceKey, sourceData] of Object.entries(discoveredData)) {
      console.log(`[MigrateDiscovered] Processing source: ${sourceKey}`);
      
      if (typeof sourceData === 'object' && sourceData && 'contracts' in sourceData) {
        const contracts = (sourceData as any).contracts;
        if (contracts && typeof contracts === 'object') {
          // Migrate contracts
          for (const [contractId, contractData] of Object.entries(contracts)) {
            updates.push({
              path: `contracts/${contractId}`,
              data: contractData
            });
            totalContractsMigrated++;
          }
        }
      }

      if (typeof sourceData === 'object' && sourceData && 'addresses' in sourceData) {
        const addresses = (sourceData as any).addresses;
        if (addresses && typeof addresses === 'object') {
          // Migrate addresses
          for (const [address, addressData] of Object.entries(addresses)) {
            updates.push({
              path: `addresses/${address}`,
              data: addressData
            });
            totalAddressesMigrated++;
          }
        }
      }
    }

    console.log(`[MigrateDiscovered] Prepared ${totalContractsMigrated} contracts and ${totalAddressesMigrated} addresses for migration`);

    // Batch update all the data
    if (updates.length > 0) {
      await unifiedBlobStorage.putBatch(updates);
      console.log(`[MigrateDiscovered] Successfully migrated ${updates.length} items`);
    }

    // Get existing contracts and addresses sections
    let contractsBlob: any = {};
    let addressesBlob: any = {};
    
    try {
      contractsBlob = await unifiedBlobStorage.get('contracts') || {};
    } catch (error) {
      console.log('[MigrateDiscovered] No existing contracts section, starting fresh');
    }
    
    try {
      addressesBlob = await unifiedBlobStorage.get('addresses') || {};
    } catch (error) {
      console.log('[MigrateDiscovered] No existing addresses section, starting fresh');
    }

    // Add individual contract data to the contracts blob
    for (const [sourceKey, sourceData] of Object.entries(discoveredData)) {
      if (typeof sourceData === 'object' && sourceData && 'contracts' in sourceData) {
        const contracts = (sourceData as any).contracts;
        if (contracts && typeof contracts === 'object') {
          for (const [contractId, contractData] of Object.entries(contracts)) {
            contractsBlob[contractId] = contractData;
          }
        }
      }

      if (typeof sourceData === 'object' && sourceData && 'addresses' in sourceData) {
        const addresses = (sourceData as any).addresses;
        if (addresses && typeof addresses === 'object') {
          for (const [address, addressData] of Object.entries(addresses)) {
            addressesBlob[address] = addressData;
          }
        }
      }
    }

    // Add metadata
    contractsBlob.lastUpdated = new Date().toISOString();
    contractsBlob.source = 'migrated-from-discovered';
    contractsBlob.migrationSummary = {
      totalContractsMigrated,
      migratedFrom: Object.keys(discoveredData),
      migrationDate: new Date().toISOString()
    };

    addressesBlob.lastUpdated = new Date().toISOString();
    addressesBlob.source = 'migrated-from-discovered';
    addressesBlob.migrationSummary = {
      totalAddressesMigrated,
      migratedFrom: Object.keys(discoveredData),
      migrationDate: new Date().toISOString()
    };

    // Update the main sections with the complete data
    await unifiedBlobStorage.put('contracts', contractsBlob);
    await unifiedBlobStorage.put('addresses', addressesBlob);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      migration: {
        contractsMigrated: totalContractsMigrated,
        addressesMigrated: totalAddressesMigrated,
        totalItemsMigrated: updates.length,
        sourcesProcessed: Object.keys(discoveredData),
        nextSteps: [
          'Data is now available in main contracts and addresses sections',
          'You can access contracts via /api/v1/contracts',
          'You can access addresses via /api/v1/addresses'
        ]
      }
    });

  } catch (error) {
    console.error('[MigrateDiscovered] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to migrate discovered data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also support POST for cron services
export const POST = GET;