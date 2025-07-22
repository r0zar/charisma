import { NextRequest, NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Fix prices structure to show proper folder hierarchy
 * GET /api/cron/fix-prices-structure
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[FixPricesStructure] Starting prices structure fix...');

    // Get current root blob
    const rootBlob = await unifiedBlobStorage.getRootBlob();
    
    // Check current prices structure
    const currentPrices = rootBlob.prices || {};
    console.log('[FixPricesStructure] Current prices keys:', Object.keys(currentPrices));
    
    // Extract token data that's directly at root level
    const tokenData: Record<string, any> = {};
    const nonTokenKeys = ['current', 'historical', 'pairs', '__metadata'];
    
    for (const [key, value] of Object.entries(currentPrices)) {
      if (!nonTokenKeys.includes(key) && key.includes('.')) {
        // This looks like a token contract ID
        tokenData[key] = value;
      }
    }
    
    console.log('[FixPricesStructure] Found token data for:', Object.keys(tokenData));
    
    // Create proper folder structure
    const newPricesStructure = {
      current: tokenData,  // Move token data to current subfolder
      historical: currentPrices.historical || {},
      pairs: currentPrices.pairs || {},
      __metadata: {
        lastUpdated: new Date().toISOString(),
        totalTokens: Object.keys(tokenData).length,
        folders: ['current', 'historical', 'pairs'],
        description: 'Charisma price data organized by category'
      }
    };
    
    // Update the root blob
    rootBlob.prices = newPricesStructure;
    rootBlob.lastUpdated = new Date().toISOString();
    
    // Save the updated structure using batch update
    await unifiedBlobStorage.putBatch([
      { path: 'prices', data: newPricesStructure }
    ]);
    
    // Clear cache
    unifiedBlobStorage.clearCache();
    
    console.log('[FixPricesStructure] Successfully restructured prices');
    
    return NextResponse.json({
      success: true,
      message: 'Prices structure fixed to show proper folders',
      timestamp: new Date().toISOString(),
      moved: {
        tokenCount: Object.keys(tokenData).length,
        from: 'prices/*',
        to: 'prices/current/*'
      },
      newStructure: {
        'prices/current': `${Object.keys(tokenData).length} tokens`,
        'prices/historical': 'Empty - ready for historical data', 
        'prices/pairs': 'Empty - ready for trading pairs',
        'prices/__metadata': 'Folder metadata and info'
      }
    });

  } catch (error) {
    console.error('[FixPricesStructure] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fix prices structure',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}