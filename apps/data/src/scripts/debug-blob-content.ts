#!/usr/bin/env tsx

/**
 * Debug script to check blob storage content and identify issues
 */

import { blobStorageService } from '../services/blob-storage-service';
import { BlobDebugger } from '../lib/blob-debug';

async function debugBlobContent() {
  try {
    console.log('🔍 DEBUGGING BLOB STORAGE CONTENT');
    console.log('='.repeat(50));

    // Clear cache to get fresh data
    blobStorageService.clearCache();

    // Log detailed blob state
    await BlobDebugger.logBlobState();

    console.log('\n📋 DETAILED INSPECTION');
    console.log('-'.repeat(30));

    // Get root blob directly
    const rootBlob = await blobStorageService.getRoot();
    
    console.log('Root blob structure:', {
      version: rootBlob.version,
      lastUpdated: rootBlob.lastUpdated,
      hasAddresses: !!rootBlob.addresses,
      hasContracts: !!rootBlob.contracts,
      hasPrices: !!rootBlob.prices,
      metadata: rootBlob.metadata
    });

    // Check addresses in detail
    if (rootBlob.addresses) {
      const addressKeys = Object.keys(rootBlob.addresses);
      console.log(`\n🏠 ADDRESSES (${addressKeys.length}):`);
      
      if (addressKeys.length > 0) {
        addressKeys.forEach((addr, i) => {
          console.log(`  ${i + 1}. ${addr}`);
          const addressData = rootBlob.addresses[addr];
          if (addressData && typeof addressData === 'object') {
            const hasBalances = addressData.balances !== undefined;
            const hasTransactions = addressData.transactions !== undefined;
            console.log(`     - Has balances: ${hasBalances}`);
            console.log(`     - Has transactions: ${hasTransactions}`);
          }
        });
      } else {
        console.log('  ❌ No addresses found');
      }
    }

    // Check contracts in detail
    if (rootBlob.contracts) {
      const contractKeys = Object.keys(rootBlob.contracts);
      console.log(`\n📄 CONTRACTS (${contractKeys.length}):`);
      
      if (contractKeys.length > 0) {
        contractKeys.slice(0, 10).forEach((contract, i) => {
          console.log(`  ${i + 1}. ${contract}`);
        });
        if (contractKeys.length > 10) {
          console.log(`  ... and ${contractKeys.length - 10} more`);
        }
      } else {
        console.log('  ❌ No contracts found');
      }
    }

    // Check prices in detail
    if (rootBlob.prices) {
      const priceKeys = Object.keys(rootBlob.prices);
      console.log(`\n💰 PRICES (${priceKeys.length}):`);
      
      if (priceKeys.length > 0) {
        priceKeys.slice(0, 10).forEach((price, i) => {
          console.log(`  ${i + 1}. ${price}`);
        });
        if (priceKeys.length > 10) {
          console.log(`  ... and ${priceKeys.length - 10} more`);
        }
      } else {
        console.log('  ❌ No prices found');
      }
    }

    console.log('\n🧪 TESTING INDIVIDUAL PATHS');
    console.log('-'.repeat(30));

    // Test getting addresses path
    try {
      const addressesData = await blobStorageService.get('addresses');
      console.log('✅ Successfully retrieved addresses path');
      console.log(`   Contains ${Object.keys(addressesData).length} addresses`);
    } catch (error) {
      console.log('❌ Failed to get addresses path:', error);
    }

    // Test getting contracts path
    try {
      const contractsData = await blobStorageService.get('contracts');
      console.log('✅ Successfully retrieved contracts path');
      console.log(`   Contains ${Object.keys(contractsData).length} contracts`);
    } catch (error) {
      console.log('❌ Failed to get contracts path:', error);
    }

    // Test getting prices path
    try {
      const pricesData = await blobStorageService.get('prices');
      console.log('✅ Successfully retrieved prices path');
      console.log(`   Contains ${Object.keys(pricesData).length} price pairs`);
    } catch (error) {
      console.log('❌ Failed to get prices path:', error);
    }

    console.log('\n📊 RAW BLOB SIZE INFO');
    console.log('-'.repeat(30));
    const rawBlobString = JSON.stringify(rootBlob);
    console.log(`Total blob size: ${rawBlobString.length} characters`);
    console.log(`Total blob size: ${(rawBlobString.length / 1024).toFixed(2)} KB`);

    if (rawBlobString.length < 1000) {
      console.log('\n⚠️  BLOB SEEMS TOO SMALL - Showing full content:');
      console.log(JSON.stringify(rootBlob, null, 2));
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
    
    // Try to get more details about the error
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      });
    }
  }
}

// Also test a simple save/retrieve cycle
async function testSaveRetrieve() {
  console.log('\n🧪 TESTING SAVE/RETRIEVE CYCLE');
  console.log('-'.repeat(40));

  try {
    const testData = {
      'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9': {
        balances: {
          stx: { balance: '1000000000000' }
        }
      },
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS': {
        balances: {
          stx: { balance: '2000000000000' }
        }
      }
    };

    console.log('💾 Saving test address data...');
    await blobStorageService.put('addresses', testData);
    console.log('✅ Save completed');

    // Clear cache and retrieve
    blobStorageService.clearCache();
    
    console.log('📥 Retrieving saved data...');
    const retrieved = await blobStorageService.get('addresses');
    console.log('✅ Retrieve completed');
    
    const retrievedKeys = Object.keys(retrieved);
    console.log(`Retrieved ${retrievedKeys.length} addresses:`);
    retrievedKeys.forEach((addr, i) => {
      console.log(`  ${i + 1}. ${addr}`);
    });

    // Verify data integrity
    const originalKeys = Object.keys(testData);
    const match = originalKeys.every(key => retrievedKeys.includes(key)) && 
                  retrievedKeys.every(key => originalKeys.includes(key));
    
    console.log(`✅ Data integrity check: ${match ? 'PASSED' : 'FAILED'}`);

  } catch (error) {
    console.error('❌ Save/retrieve test failed:', error);
  }
}

// Run debug functions
async function main() {
  await debugBlobContent();
  await testSaveRetrieve();
}

main();