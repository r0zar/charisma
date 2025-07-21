#!/usr/bin/env tsx
/**
 * Debug Blob Storage Connection
 * Direct test of blob storage without wrapper classes
 */

import '../utils';
import { put, del } from '@vercel/blob';

async function debugBlobConnection() {
  console.log('🔍 Debugging Blob Storage Connection...');
  
  try {
    // Show environment variables
    console.log('📋 Environment Variables:');
    console.log('BLOB_BASE_URL:', process.env.BLOB_BASE_URL);
    console.log('BLOB_READ_WRITE_TOKEN:', process.env.BLOB_READ_WRITE_TOKEN ? 'Set' : 'Not set');
    
    // Test direct blob storage
    console.log('📡 Testing direct blob storage...');
    const testKey = `test-${Date.now()}.json`;
    const testData = JSON.stringify({ test: true, timestamp: Date.now() });
    
    console.log('📤 Uploading test file...');
    const result = await put(testKey, testData, {
      access: 'public',
      contentType: 'application/json'
    });
    
    console.log('✅ Upload successful:', {
      url: result.url,
      pathname: result.pathname,
      size: result.size
    });
    
    console.log('🗑️ Cleaning up test file...');
    await del(result.url);
    console.log('✅ Cleanup successful');
    
    console.success('🎉 Blob storage connection working perfectly!');
    
  } catch (error) {
    console.error('❌ Blob storage test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }
}

// Run the debug test
debugBlobConnection().catch(console.error);