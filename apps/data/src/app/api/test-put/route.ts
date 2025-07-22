import { NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

export async function GET() {
  try {
    // Clear cache first
    unifiedBlobStorage.clearCache();
    
    const testData = { test: 'simple-test', timestamp: Date.now() };
    
    // Test saving to prices/pairs
    await unifiedBlobStorage.put('prices/pairs', testData);
    console.log('Saved to prices/pairs');
    
    // Check if it was saved
    const rootBlob = await unifiedBlobStorage.getRoot();
    console.log('Root blob prices keys:', Object.keys(rootBlob.prices || {}));
    
    return NextResponse.json({
      success: true,
      pricesKeys: Object.keys(rootBlob.prices || {}),
      pricesData: rootBlob.prices
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}