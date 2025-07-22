import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Nuclear option: completely remove and recreate prices section
 * GET /api/cron/nuke-prices
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[NukePrices] Starting nuclear prices reset...');

    // Get current blob
    const currentBlob = await unifiedBlobStorage.getRootBlob();
    
    // Log what we're removing
    if (currentBlob.prices) {
      console.log('[NukePrices] Removing nested structure:', JSON.stringify(currentBlob.prices, null, 2).substring(0, 200) + '...');
    }
    
    // Completely reset the prices property
    currentBlob.prices = {};
    
    // Update metadata
    currentBlob.lastUpdated = new Date().toISOString();
    
    // Save the updated structure
    // Save the reset structure  
    await unifiedBlobStorage.put('prices', currentBlob.prices);
    
    // Clear cache
    unifiedBlobStorage.clearCache();
    
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