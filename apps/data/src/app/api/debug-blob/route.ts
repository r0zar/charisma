import { NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Debug endpoint for testing blob storage
 */
export async function GET() {
  try {
    console.log('[Debug] Starting blob storage test...');
    
    // Clear cache first
    unifiedBlobStorage.clearCache();
    
    // Test 1: Get current root blob
    const rootBlob = await unifiedBlobStorage.getRoot();
    console.log('[Debug] Root blob prices keys:', Object.keys(rootBlob.prices || {}));
    
    // Test 2: Try to put test data
    const testData = {
      test: 'debug-data',
      timestamp: Date.now()
    };
    
    console.log('[Debug] Putting test data to prices/debug...');
    await unifiedBlobStorage.put('prices/debug', testData);
    console.log('[Debug] Put completed');
    
    // Test 3: Get the data back
    const retrievedData = await unifiedBlobStorage.get('prices/debug');
    console.log('[Debug] Retrieved data:', retrievedData);
    
    // Test 4: Check root blob again
    const rootBlob2 = await unifiedBlobStorage.getRoot();
    console.log('[Debug] Root blob prices keys after put:', Object.keys(rootBlob2.prices || {}));
    
    return NextResponse.json({
      success: true,
      test: 'completed',
      before: Object.keys(rootBlob.prices || {}),
      after: Object.keys(rootBlob2.prices || {}),
      retrieved: retrievedData
    });
    
  } catch (error) {
    console.error('[Debug] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}