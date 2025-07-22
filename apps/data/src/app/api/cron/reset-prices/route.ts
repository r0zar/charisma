import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Reset corrupted prices data structure
 * GET /api/cron/reset-prices
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[ResetPrices] Starting prices data structure reset...');

    // Get current root blob
    const rootBlob = await unifiedBlobStorage.getRootBlob();
    
    // Log current structure for debugging
    if (rootBlob.prices) {
      console.log('[ResetPrices] Current prices keys:', Object.keys(rootBlob.prices));
    }
    
    // Clear cache to ensure fresh data
    unifiedBlobStorage.clearCache();
    
    // Reset prices to clean structure using the public API
    await unifiedBlobStorage.put('prices', {
      current: {}  // Clean starting point for current prices
    });
    
    console.log('[ResetPrices] Successfully reset prices structure');
    
    return NextResponse.json({
      success: true,
      message: 'Prices data structure has been reset',
      timestamp: new Date().toISOString(),
      newStructure: {
        prices: {
          current: 'Empty - ready for fresh data'
        }
      }
    });

  } catch (error) {
    console.error('[ResetPrices] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to reset prices structure',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}