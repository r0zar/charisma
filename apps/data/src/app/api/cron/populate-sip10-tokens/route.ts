import { NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * One-time cron to populate contract and address data from Charisma SIP-10 tokens API
 * GET /api/cron/populate-sip10-tokens
 */
export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('[SIP10Cron] Starting data population from Charisma SIP-10 tokens API...');
    
    // Fetch SIP-10 token data from Charisma API
    const response = await fetch('https://tokens.charisma.rocks/api/v1/sip10');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch SIP-10 tokens data: ${response.status} ${response.statusText}`);
    }
    
    const tokensData = await response.json();
    const tokens = Array.isArray(tokensData) ? tokensData : Object.values(tokensData);
    console.log(`[SIP10Cron] Fetched ${tokens.length} SIP-10 token entries`);
    
    // Prepare contracts and addresses data
    const contractsUpdates: Array<{ path: string; data: any }> = [];
    const addressesUpdates: Array<{ path: string; data: any }> = [];
    const addressSet = new Set<string>(); // Track unique addresses
    
    // Process token data
    for (const token of tokens) {
      try {
        // Extract contract information
        if (token.contract_principal || token.external?.contractId) {
          const contractId = token.contract_principal || token.external?.contractId;
          const contractData = {
            contractId,
            contractAddress: contractId.split('.')[0],
            contractName: contractId.split('.')[1] || contractId,
            name: token.name || token.external?.name || 'Unknown Token',
            symbol: token.symbol || token.external?.symbol,
            description: token.description || token.external?.description || '',
            type: 'SIP-10-TOKEN',
            protocol: 'STACKS',
            source: 'charisma-tokens-api',
            lastUpdated: Date.now(),
            metadata: {
              decimals: token.decimals || token.external?.decimals || 6,
              identifier: token.identifier,
              image: token.image || token.external?.image,
              tokenUri: token.token_uri,
              totalSupply: token.total_supply,
              lastRefreshed: token.lastRefreshed || token.external?.lastUpdated,
              external: token.external,
              originalData: token
            }
          };
          
          contractsUpdates.push({
            path: `contracts/${contractId}`,
            data: contractData
          });
          
          // Extract address from contract ID
          const address = contractId.split('.')[0];
          if (address && address.match(/^S[PTM]/)) {
            addressSet.add(address);
          }
        }
        
      } catch (error) {
        console.warn(`[SIP10Cron] Error processing token:`, token, error);
      }
    }
    
    // Create address data for all unique addresses
    for (const address of addressSet) {
      const addressData = {
        address,
        type: 'sip10-token-deployer',
        source: 'charisma-tokens-api',
        lastUpdated: Date.now(),
        metadata: {
          inferredFrom: 'sip10-token-contracts',
          network: 'mainnet',
          tokenType: 'SIP-10'
        }
      };
      
      addressesUpdates.push({
        path: `addresses/${address}`,
        data: addressData
      });
    }
    
    console.log(`[SIP10Cron] Processing ${contractsUpdates.length} contracts and ${addressesUpdates.length} addresses...`);
    
    // Store discovered data in the discovered section
    if (contractsUpdates.length > 0 || addressesUpdates.length > 0) {
      const discoveredData = {
        lastUpdated: new Date().toISOString(),
        source: 'sip10-tokens-harvester',
        type: 'token-data',
        summary: {
          contractsFound: contractsUpdates.length,
          addressesFound: addressesUpdates.length,
          totalTokensProcessed: tokens.length
        },
        contracts: {},
        addresses: {}
      };
      
      // Add discovered contracts
      for (const update of contractsUpdates) {
        const contractId = update.path.replace('contracts/', '');
        discoveredData.contracts[contractId] = update.data;
      }
      
      // Add discovered addresses
      for (const update of addressesUpdates) {
        const address = update.path.replace('addresses/', '');
        discoveredData.addresses[address] = update.data;
      }
      
      // Store in discovered section
      await unifiedBlobStorage.put('discovered/sip10-tokens', discoveredData);
      console.log(`[SIP10Cron] Stored discovered data: ${contractsUpdates.length} contracts, ${addressesUpdates.length} addresses`);
    }
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      summary: {
        tokensProcessed: tokens.length,
        contractsCreated: contractsUpdates.length,
        addressesCreated: addressesUpdates.length,
        uniqueAddresses: addressSet.size,
        tokenTypes: {
          sip10: contractsUpdates.length
        }
      },
      source: 'charisma-sip10-tokens-api'
    });
    
  } catch (error) {
    console.error('[SIP10Cron] Error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      error: 'Failed to populate from Charisma SIP-10 tokens API',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support POST for cron services
export const POST = GET;