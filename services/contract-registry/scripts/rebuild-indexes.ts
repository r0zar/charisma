#!/usr/bin/env tsx

/**
 * Rebuild KV Indexes from Blob Storage
 * 
 * This script rebuilds the KV indexes from existing blob storage data.
 * Use this when indexes are out of sync with blob storage.
 */

import { ContractRegistry, createDefaultConfig } from '../src/index.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function rebuildIndexes() {
  console.log('🔧 Rebuilding KV indexes from blob storage...\n');
  
  // Create registry with default config
  const config = createDefaultConfig({
    serviceName: 'index-rebuild',
    blobStoragePrefix: 'contracts/',
    indexTTL: 3600,
    enableAnalysis: false,  // Don't re-analyze, just rebuild indexes
    enableDiscovery: false
  });
  
  const registry = new ContractRegistry(config);
  
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
    
    // Step 3: Rebuild indexes
    console.log('\n🔨 Rebuilding indexes...');
    let processed = 0;
    let errors = 0;
    
    // Process in smaller batches to avoid timeouts
    const batchSize = 50;
    const totalBatches = Math.ceil(allBlobs.length / batchSize);
    
    for (let i = 0; i < allBlobs.length && i < 100; i += batchSize) {
      const batch = allBlobs.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      console.log(`\n📦 Processing batch ${batchNum}/${Math.min(totalBatches, Math.ceil(100/batchSize))} (${batch.length} contracts)...`);
      
      for (const blobKey of batch) {
        try {
          // Get contract metadata from blob
          const metadata = await registry['blobStorage'].getContract(blobKey);
          
          if (metadata) {
            // Add to indexes using the index manager directly
            await registry['indexManager'].addToIndexes(blobKey, metadata);
            processed++;
            
            if (processed % 10 === 0) {
              console.log(`  ✅ Processed ${processed} contracts...`);
            }
          } else {
            console.log(`  ⚠️  No metadata found for ${blobKey}`);
            errors++;
          }
        } catch (error) {
          console.error(`  ❌ Error processing ${blobKey}:`, error);
          errors++;
          
          // Continue processing other contracts
          if (errors > 10) {
            console.log(`  ⚠️  Too many errors (${errors}), stopping batch`);
            break;
          }
        }
      }
    }
    
    // Step 4: Verify rebuild
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
      console.log('\n💡 Next steps:');
      console.log('1. Refresh the contracts page in your browser');
      console.log('2. Check that contracts are now visible');
      console.log('3. Test filtering and pagination');
    } else {
      console.log('\n❌ Index rebuild failed. No contracts were indexed.');
      console.log('Check the error messages above for troubleshooting.');
    }
    
  } catch (error) {
    console.error('❌ Failed to rebuild indexes:', error);
    process.exit(1);
  }
}

// Run the script
rebuildIndexes().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});