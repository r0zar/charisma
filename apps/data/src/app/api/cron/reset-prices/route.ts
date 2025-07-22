import { NextRequest, NextResponse } from 'next/server';
import { blobStorageService } from '@/lib/storage/blob-storage-service';

export const runtime = 'edge';

/**
 * Reset corrupted prices data structure
 * GET /api/cron/reset-prices
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[ResetPrices] Starting prices data structure reset...');

    // Get current root blob
    const rootBlob = await blobStorageService.getRootBlob();
    
    // Log current structure for debugging
    if (rootBlob.prices) {
      console.log('[ResetPrices] Current prices keys:', Object.keys(rootBlob.prices));
    }
    
    // Reset prices to clean structure
    rootBlob.prices = {
      current: {}  // Clean starting point for current prices
    };
    
    // Save the updated root blob
    await blobStorageService.saveRootBlob(rootBlob);
    
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