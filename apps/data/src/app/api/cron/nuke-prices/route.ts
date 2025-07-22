import { NextRequest, NextResponse } from 'next/server';
import { blobStorageService } from '@/lib/storage/blob-storage-service';

export const runtime = 'edge';

/**
 * Nuclear option: completely remove and recreate prices section
 * GET /api/cron/nuke-prices
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[NukePrices] Starting nuclear prices reset...');

    // Get current blob
    const currentBlob = await blobStorageService.getRootBlob();
    
    // Log what we're removing
    if (currentBlob.prices) {
      console.log('[NukePrices] Removing nested structure:', JSON.stringify(currentBlob.prices, null, 2).substring(0, 200) + '...');
    }
    
    // Completely delete the prices property and recreate it
    delete currentBlob.prices;
    
    // Create a completely fresh prices structure
    currentBlob.prices = {};
    
    // Update metadata
    currentBlob.lastUpdated = new Date().toISOString();
    
    // Save the updated structure
    await blobStorageService.saveRootBlob(currentBlob);
    
    // Nuclear cache clear
    // @ts-ignore - accessing private property for cache clearing
    blobStorageService.rootBlobCache = null;
    // @ts-ignore - accessing private property for cache clearing  
    blobStorageService.cacheTimestamp = 0;
    
    console.log('[NukePrices] Nuclear reset complete');
    
    return NextResponse.json({
      success: true,
      message: 'Prices section completely nuked and recreated',
      timestamp: new Date().toISOString(),
      warning: 'All price data has been permanently removed',
      newStructure: 'Empty prices object ready for fresh data'
    });

  } catch (error) {
    console.error('[NukePrices] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to nuke prices section',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}