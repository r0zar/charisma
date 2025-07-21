#!/usr/bin/env tsx

// Quick script to inspect blob URLs and understand URL patterns
import { ContractRegistry, createDefaultConfig } from '../src/index.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function inspectBlobUrls() {
  console.log('🔍 Inspecting blob URLs...');
  
  const config = createDefaultConfig('mainnet-contract-registry');
  const registry = new ContractRegistry(config);

  try {
    // Get a small sample of contracts
    const allContracts = await registry.getAllContracts();
    console.log(`Found ${allContracts.length} total contracts`);
    
    if (allContracts.length === 0) {
      console.log('❌ No contracts found in registry');
      return;
    }

    // Get 10 contracts and log their blob URLs
    const testContracts = allContracts.slice(0, 10);
    console.log(`\n📋 Testing ${testContracts.length} contracts for URL patterns...`);
    
    for (const contractId of testContracts) {
      try {
        // Access the blob storage directly to get URLs
        const blobStorage = (registry as any).blobStorage;
        const path = blobStorage.getContractPath(contractId);
        
        // Use head to get the URL (we'll analyze this to understand patterns)
        const headResult = await blobStorage.monitor.head(path);
        
        if (headResult) {
          console.log(`✅ ${contractId}`);
          console.log(`   Path: ${path}`);
          console.log(`   URL: ${headResult.url}`);
          console.log(`   Size: ${headResult.size} bytes`);
          console.log('');
        } else {
          console.log(`❌ ${contractId} - No blob found`);
        }
      } catch (error) {
        console.log(`💥 ${contractId} - Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run the inspection
inspectBlobUrls()
  .then(() => {
    console.log('🎉 Blob URL inspection completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Inspection failed:', error);
    process.exit(1);
  });