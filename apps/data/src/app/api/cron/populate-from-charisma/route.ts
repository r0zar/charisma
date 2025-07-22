import { NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * One-time cron to populate contract and address data from Charisma vaults API
 * GET /api/cron/populate-from-charisma
 */
export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('[CharismaCron] Starting data population from Charisma vaults API...');
    
    // Fetch vault data from Charisma API
    const response = await fetch('https://invest.charisma.rocks/api/v1/vaults');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch vaults data: ${response.status} ${response.statusText}`);
    }
    
    const vaultsResponse = await response.json();
    const vaults = vaultsResponse.data || vaultsResponse;
    console.log(`[CharismaCron] Fetched ${Array.isArray(vaults) ? vaults.length : Object.keys(vaults).length} vault entries`);
    
    // Prepare contracts and addresses data
    const contractsUpdates: Array<{ path: string; data: any }> = [];
    const addressesUpdates: Array<{ path: string; data: any }> = [];
    const addressSet = new Set<string>(); // Track unique addresses
    
    for (const vault of vaults) {
      try {
        // Extract contract information
        if (vault.contractId) {
          const contractId = vault.contractId;
          const contractData = {
            contractId,
            contractAddress: vault.contractAddress,
            contractName: vault.contractName,
            name: vault.name || 'Unknown Pool',
            symbol: vault.symbol || vault.identifier,
            description: vault.description || '',
            type: vault.type || 'POOL',
            protocol: vault.protocol || 'CHARISMA',
            source: 'charisma-vaults-api',
            lastUpdated: Date.now(),
            metadata: {
              decimals: vault.decimals || 6,
              fee: vault.fee,
              image: vault.image,
              externalPoolId: vault.externalPoolId,
              engineContractId: vault.engineContractId,
              tokenA: vault.tokenA,
              tokenB: vault.tokenB,
              originalData: vault
            }
          };
          
          contractsUpdates.push({
            path: `contracts/${contractId}`,
            data: contractData
          });
          
          // Extract address from contract ID
          const address = vault.contractAddress || contractId.split('.')[0];
          if (address && address.match(/^S[PTM]/)) {
            addressSet.add(address);
          }
        }
        
        // Extract any other addresses from vault data
        if (vault.contractAddress && vault.contractAddress.match(/^S[PTM]/)) {
          addressSet.add(vault.contractAddress);
        }
        
        // Extract addresses from token data
        if (vault.tokenA?.contractId && vault.tokenA.contractId !== '.stx') {
          const tokenAAddress = vault.tokenA.contractId.split('.')[0];
          if (tokenAAddress && tokenAAddress.match(/^S[PTM]/)) {
            addressSet.add(tokenAAddress);
          }
        }
        if (vault.tokenB?.contractId && vault.tokenB.contractId !== '.stx') {
          const tokenBAddress = vault.tokenB.contractId.split('.')[0];
          if (tokenBAddress && tokenBAddress.match(/^S[PTM]/)) {
            addressSet.add(tokenBAddress);
          }
        }
        
      } catch (error) {
        console.warn(`[CharismaCron] Error processing vault:`, vault, error);
      }
    }
    
    // Create address data for all unique addresses
    for (const address of addressSet) {
      const addressData = {
        address,
        type: 'vault-related',
        source: 'charisma-api',
        lastUpdated: Date.now(),
        metadata: {
          inferredFrom: 'vault-contracts',
          network: 'mainnet'
        }
      };
      
      addressesUpdates.push({
        path: `addresses/${address}`,
        data: addressData
      });
    }
    
    // Batch update all data
    console.log(`[CharismaCron] Updating ${contractsUpdates.length} contracts and ${addressesUpdates.length} addresses...`);
    
    const allUpdates = [...contractsUpdates, ...addressesUpdates];
    
    if (allUpdates.length > 0) {
      await unifiedBlobStorage.putBatch(allUpdates);
    }
    
    // Get existing contracts and addresses blobs first
    let contractsBlob: any = {};
    let addressesBlob: any = {};
    
    try {
      contractsBlob = await unifiedBlobStorage.get('contracts') || {};
    } catch (error) {
      console.log('[CharismaCron] No existing contracts blob, creating new one');
      contractsBlob = {};
    }
    
    try {
      addressesBlob = await unifiedBlobStorage.get('addresses') || {};
    } catch (error) {
      console.log('[CharismaCron] No existing addresses blob, creating new one');
      addressesBlob = {};
    }
    
    // Update the main contracts blob
    if (contractsUpdates.length > 0) {
      contractsBlob.lastUpdated = new Date().toISOString();
      contractsBlob.source = 'charisma-api-population';
      contractsBlob.contractCount = (contractsBlob.contractCount || 0) + contractsUpdates.length;
      
      // Add each contract to the main blob
      for (const update of contractsUpdates) {
        const contractId = update.path.replace('contracts/', '');
        contractsBlob[contractId] = update.data;
      }
      
      await unifiedBlobStorage.put('contracts', contractsBlob);
    }
    
    // Update the main addresses blob
    if (addressesUpdates.length > 0) {
      addressesBlob.lastUpdated = new Date().toISOString();
      addressesBlob.source = 'charisma-api-population';
      addressesBlob.addressCount = (addressesBlob.addressCount || 0) + addressesUpdates.length;
      
      // Add each address to the main blob
      for (const update of addressesUpdates) {
        const address = update.path.replace('addresses/', '');
        addressesBlob[address] = update.data;
      }
      
      await unifiedBlobStorage.put('addresses', addressesBlob);
    }
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      summary: {
        vaultsProcessed: vaults.length,
        contractsCreated: contractsUpdates.length,
        addressesCreated: addressesUpdates.length,
        uniqueAddresses: addressSet.size
      },
      source: 'charisma-vaults-api'
    });
    
  } catch (error) {
    console.error('[CharismaCron] Error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      error: 'Failed to populate from Charisma API',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support POST for cron services
export const POST = GET;