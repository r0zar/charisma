#!/usr/bin/env tsx

/**
 * Diagnose the blob storage issue - works with or without token
 */

import { blobStorageService } from '../services/blob-storage-service';

async function diagnoseIssue() {
  console.log('🔧 DIAGNOSING BLOB STORAGE ISSUE');
  console.log('='.repeat(45));

  // Check environment
  console.log('🌍 Environment Check:');
  console.log(`  - BLOB_READ_WRITE_TOKEN: ${process.env.BLOB_READ_WRITE_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('\n❌ Cannot proceed without BLOB_READ_WRITE_TOKEN');
    console.log('💡 Please set your Vercel Blob token:');
    console.log('   export BLOB_READ_WRITE_TOKEN="your_token_here"');
    return;
  }

  try {
    console.log('\n📊 Current Blob State:');
    
    // Clear cache first
    blobStorageService.clearCache();
    console.log('  - Cache cleared');

    // Try to get current root blob
    const rootBlob = await blobStorageService.getRoot();
    console.log('  - Root blob retrieved successfully');

    // Count current data
    const addressCount = Object.keys(rootBlob.addresses || {}).length;
    const contractCount = Object.keys(rootBlob.contracts || {}).length;
    const priceCount = Object.keys(rootBlob.prices || {}).length;

    console.log(`  - Addresses: ${addressCount}`);
    console.log(`  - Contracts: ${contractCount}`);
    console.log(`  - Prices: ${priceCount}`);

    if (addressCount > 0) {
      console.log('\n🏠 Current Address Keys:');
      Object.keys(rootBlob.addresses).forEach((addr, i) => {
        console.log(`  ${i + 1}. ${addr}`);
      });
    }

    if (contractCount > 0) {
      console.log('\n📄 Current Contract Keys (first 10):');
      Object.keys(rootBlob.contracts).slice(0, 10).forEach((contract, i) => {
        console.log(`  ${i + 1}. ${contract}`);
      });
      if (contractCount > 10) {
        console.log(`  ... and ${contractCount - 10} more`);
      }
    }

    console.log('\n🧪 Testing Small Batch Update:');
    
    // Test with just 3 addresses to see if the issue persists
    const smallTestData = {
      addresses: {
        'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9': {
          balances: { stx: { balance: '1000000' } },
          transactions: { limit: 20, offset: 0, total: 1, results: [] }
        },
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS': {
          balances: { stx: { balance: '2000000' } },
          transactions: { limit: 20, offset: 0, total: 2, results: [] }
        },
        'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1': {
          balances: { stx: { balance: '3000000' } },
          transactions: { limit: 20, offset: 0, total: 3, results: [] }
        }
      },
      contracts: {
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token': {
          metadata: { name: 'charisma-token', symbol: 'CHA' }
        },
        'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token': {
          metadata: { name: 'welshcorgicoin-token', symbol: 'WELSH' }
        }
      },
      prices: {
        'CHA-USDA': { current: { price: '1.25' } },
        'WELSH-USDA': { current: { price: '0.0001' } }
      }
    };

    console.log('  - Applying batch update with 3 addresses, 2 contracts, 2 prices...');
    
    await blobStorageService.putBatch([
      { path: 'addresses', data: smallTestData.addresses },
      { path: 'contracts', data: smallTestData.contracts },
      { path: 'prices', data: smallTestData.prices }
    ]);

    console.log('  - Batch update completed');

    // Clear cache and verify
    console.log('  - Clearing cache and verifying...');
    blobStorageService.clearCache();

    const verifyBlob = await blobStorageService.getRoot();
    const newAddressCount = Object.keys(verifyBlob.addresses || {}).length;
    const newContractCount = Object.keys(verifyBlob.contracts || {}).length;
    const newPriceCount = Object.keys(verifyBlob.prices || {}).length;

    console.log('\n✅ POST-UPDATE VERIFICATION:');
    console.log(`  - Addresses: ${newAddressCount} (expected: 3)`);
    console.log(`  - Contracts: ${newContractCount} (expected: 2)`);
    console.log(`  - Prices: ${newPriceCount} (expected: 2)`);

    if (newAddressCount === 3 && newContractCount === 2 && newPriceCount === 2) {
      console.log('\n🎉 SUCCESS: Batch update is working correctly!');
      console.log('💡 The issue might be with the original seeding script data processing');
    } else {
      console.log('\n❌ ISSUE CONFIRMED: Batch update is still not working properly');
      
      if (newAddressCount === 1) {
        console.log('🔍 Still only seeing 1 address - investigating further...');
        
        // Show what address we actually have
        const addressKeys = Object.keys(verifyBlob.addresses || {});
        console.log(`📍 The single address found: ${addressKeys[0]}`);
        
        // Check if it's the last one written (which would indicate overwrites)
        const expectedLast = 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1';
        if (addressKeys[0] === expectedLast) {
          console.log('⚠️  This is the LAST address in our test - suggests data is being overwritten');
        }
      }
    }

    console.log('\n🔍 Detailed Root Blob Structure:');
    const blobString = JSON.stringify(verifyBlob, null, 2);
    console.log(`  - Total size: ${blobString.length} characters`);
    
    if (blobString.length < 2000) {
      console.log('\n📋 Full blob content (small enough to show):');
      console.log(blobString);
    } else {
      console.log('  - Blob too large to show completely');
      console.log('  - Addresses section:', JSON.stringify(verifyBlob.addresses, null, 2).slice(0, 500) + '...');
    }

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

// Run diagnosis
diagnoseIssue();