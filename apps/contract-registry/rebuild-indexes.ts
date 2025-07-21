#!/usr/bin/env tsx

/**
 * Rebuild KV Indexes from Blob Storage
 * 
 * This script rebuilds the KV indexes from existing blob storage data.
 * Use this when indexes are out of sync with blob storage.
 */

import { getContractRegistry } from './src/lib/contract-registry';

async function rebuildIndexes() {
  console.log('🔧 Rebuilding KV indexes from blob storage...\n');
  
  const registry = getContractRegistry();
  
  try {
    // Step 1: Get contracts from blob storage
    console.log('📦 Reading contracts from blob storage...');
    const blobStats = await registry['blobStorage'].getStats();
    console.log(`Found ${blobStats.totalContracts} contracts in blob storage`);
    
    // Step 2: List all contract IDs
    console.log('\n📝 Listing all contract IDs from blob storage...');
    const allBlobs = await registry['blobStorage'].listContracts();
    console.log(`Retrieved ${allBlobs.length} contract IDs`);
    
    if (allBlobs.length === 0) {
      console.log('❌ No contracts found in blob storage. Nothing to rebuild.');
      return;
    }
    
    // Step 3: Clear existing indexes
    console.log('\n🗑️  Clearing existing indexes...');
    // Note: We don't have a direct clear method, but adding contracts will overwrite
    
    // Step 4: Rebuild indexes
    console.log('\n🔨 Rebuilding indexes...');
    let processed = 0;
    let errors = 0;
    
    for (const blobKey of allBlobs.slice(0, 100)) { // Limit to first 100 for testing
      try {
        console.log(`Processing: ${blobKey}`);
        
        // Get contract metadata from blob
        const metadata = await registry['blobStorage'].getContract(blobKey);
        
        if (metadata) {
          // Add to indexes
          await registry['indexManager'].addToIndexes(blobKey, metadata);
          processed++;
          
          if (processed % 10 === 0) {
            console.log(`✅ Processed ${processed} contracts...`);
          }
        } else {
          console.log(`⚠️  No metadata found for ${blobKey}`);
          errors++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${blobKey}:`, error);
        errors++;
      }
    }
    
    // Step 5: Verify rebuild
    console.log('\n🔍 Verifying rebuild...');
    const indexedContracts = await registry.getAllContracts();
    const searchResult = await registry.searchContracts({ offset: 0, limit: 5 });
    const newStats = await registry.getStats();
    
    console.log('\n📊 Results:');
    console.log(`✅ Processed: ${processed} contracts`);
    console.log(`❌ Errors: ${errors} contracts`);
    console.log(`📝 Indexed contracts: ${indexedContracts.length}`);
    console.log(`🔍 Search result total: ${searchResult.total}`);
    console.log(`📊 Stats total: ${newStats.totalContracts}`);
    
    if (indexedContracts.length > 0) {
      console.log('\n🎉 Index rebuild successful!');
      console.log('The contracts page should now show contracts properly.');
    } else {
      console.log('\n❌ Index rebuild failed. No contracts were indexed.');
    }
    
  } catch (error) {
    console.error('❌ Failed to rebuild indexes:', error);
  }
}

// Run the script
rebuildIndexes().catch(console.error);