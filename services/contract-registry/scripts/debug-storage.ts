#!/usr/bin/env tsx

/**
 * Debug script to test storage layer connectivity
 */

import { BlobStorage } from '../src/storage/BlobStorage';
import { IndexManager } from '../src/storage/IndexManager';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function debugStorage() {
  console.log('🔧 Debug: Testing storage layer connectivity...');
  
  try {
    console.log('✅ Step 1: Testing environment variables...');
    console.log('   KV_REST_API_URL:', process.env.KV_REST_API_URL ? 'SET' : 'MISSING');
    console.log('   KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? 'SET' : 'MISSING');
    console.log('   BLOB_READ_WRITE_TOKEN:', process.env.BLOB_READ_WRITE_TOKEN ? 'SET' : 'MISSING');
    
    console.log('✅ Step 2: Initializing BlobStorage...');
    const blobStorage = new BlobStorage({
      serviceName: 'debug-test',
      pathPrefix: 'debug/'
    });
    console.log('✅ BlobStorage initialized');
    
    console.log('✅ Step 3: Initializing IndexManager...');
    const indexManager = new IndexManager({
      serviceName: 'debug-test',
      keyPrefix: 'debug:',
      indexTTL: 86400
    });
    console.log('✅ IndexManager initialized');
    
    console.log('✅ Step 4: Testing IndexManager.getStats() with timeout...');
    const indexTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('IndexManager.getStats() timed out after 10s')), 10000)
    );
    
    const indexStats = await Promise.race([
      indexManager.getStats(),
      indexTimeoutPromise
    ]);
    console.log('✅ IndexManager.getStats() completed:', indexStats);
    
    console.log('🎉 Storage layer tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Storage debug failed:', error);
    if (error.message?.includes('fetch')) {
      console.error('💡 This looks like a network connectivity issue.');
      console.error('💡 Try checking your internet connection and Vercel storage credentials.');
    }
    process.exit(1);
  }
}

debugStorage();