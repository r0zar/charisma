import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Reset corrupted prices data structure
 * GET /api/cron/reset-prices?confirm=RESET_PRICE_STRUCTURE
 * DANGEROUS: Requires explicit confirmation parameter
 */
export async function GET(request: NextRequest) {
  try {
    // SAFETY CHECK: Require explicit confirmation
    const url = new URL(request.url);
    const confirm = url.searchParams.get('confirm');
    
    if (confirm !== 'RESET_PRICE_STRUCTURE') {
      return NextResponse.json({
        error: 'SAFETY PROTECTION ACTIVE',
        message: 'This endpoint resets all price data structure',
        required: 'Add ?confirm=RESET_PRICE_STRUCTURE to proceed',
        warning: 'This action will clear all existing price data'
      }, { status: 400 });
    }
    
    console.log('[ResetPrices] CONFIRMED DESTRUCTIVE ACTION - Starting prices data structure reset...');

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