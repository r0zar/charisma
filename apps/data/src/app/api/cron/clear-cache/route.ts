import { NextRequest, NextResponse } from 'next/server';
import { blobStorageService } from '@/lib/storage/blob-storage-service';

export const runtime = 'edge';

/**
 * Clear all blob caches and force fresh data
 * GET /api/cron/clear-cache
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[ClearCache] Starting cache clear...');

    // Force clear the blob storage cache
    // @ts-ignore - accessing private property for cache clearing
    blobStorageService.rootBlobCache = null;
    // @ts-ignore - accessing private property for cache clearing  
    blobStorageService.cacheTimestamp = 0;
    
    console.log('[ClearCache] Blob storage cache cleared');
    
    return NextResponse.json({
      success: true,
      message: 'All caches have been cleared',
      timestamp: new Date().toISOString(),
      note: 'Next API call will fetch fresh data from blob storage'
    });

  } catch (error) {
    console.error('[ClearCache] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to clear caches',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}