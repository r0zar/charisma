import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Completely rebuild the blob structure from scratch
 * GET /api/cron/rebuild-blob
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[RebuildBlob] Starting complete blob rebuild...');

    // Get current blob to preserve addresses and contracts
    const currentBlob = await unifiedBlobStorage.getRoot();
    
    // Create a completely fresh root blob structure
    const freshBlob = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      addresses: currentBlob.addresses || {},  // Preserve existing addresses
      contracts: currentBlob.contracts || {},  // Preserve existing contracts
      prices: {                                // Start fresh with prices
        current: {}
      },
      metadata: {
        totalSize: 0,
        entryCount: Object.keys(currentBlob.addresses || {}).length + 
                   Object.keys(currentBlob.contracts || {}).length,
        regions: ['us-east-1']
      }
    };
    
    // Save the completely rebuilt structure
    await unifiedBlobStorage.put('', freshBlob);
    
    // Clear cache
    // @ts-ignore - accessing private property for cache clearing
    unifiedBlobStorage.clearCache();
    // @ts-ignore - accessing private property for cache clearing  
    // Cache already cleared above
    
    console.log('[RebuildBlob] Successfully rebuilt blob structure');
    
    return NextResponse.json({
      success: true,
      message: 'Blob structure completely rebuilt',
      timestamp: new Date().toISOString(),
      preserved: {
        addresses: Object.keys(currentBlob.addresses || {}).length,
        contracts: Object.keys(currentBlob.contracts || {}).length
      },
      reset: {
        prices: 'Completely reset to clean structure'
      }
    });

  } catch (error) {
    console.error('[RebuildBlob] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to rebuild blob structure',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}