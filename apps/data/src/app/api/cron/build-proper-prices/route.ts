import { NextRequest, NextResponse } from 'next/server';
import { blobStorageService } from '@/lib/storage/blob-storage-service';

export const runtime = 'edge';

/**
 * Build the proper prices folder structure from scratch
 * GET /api/cron/build-proper-prices
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[BuildProperPrices] Building correct prices structure...');

    // Get current root blob
    const rootBlob = await blobStorageService.getRootBlob();
    
    // Create the proper prices folder structure
    rootBlob.prices = {
      current: {
        // Individual token prices will be stored here by the handler
      },
      historical: {
        // Historical price data will be stored here
      }, 
      pairs: {
        // Trading pair data will be stored here
      },
      __metadata: {
        description: 'Charisma blockchain price data',
        version: '1.0.0',
        folders: {
          current: 'Real-time token prices from oracle services',
          historical: 'Historical price data and time series',
          pairs: 'Trading pair information and liquidity data'
        },
        lastUpdated: new Date().toISOString(),
        totalTokens: 0
      }
    };
    
    // Update root blob metadata
    rootBlob.lastUpdated = new Date().toISOString();
    
    // Save the clean structure
    await blobStorageService.saveRootBlob(rootBlob);
    
    // Nuclear cache clear
    // @ts-ignore - accessing private property for cache clearing
    blobStorageService.rootBlobCache = null;
    // @ts-ignore - accessing private property for cache clearing  
    blobStorageService.cacheTimestamp = 0;
    
    console.log('[BuildProperPrices] Built proper prices structure');
    
    return NextResponse.json({
      success: true,
      message: 'Proper prices folder structure created',
      timestamp: new Date().toISOString(),
      structure: {
        'prices/current': 'Ready for real-time token prices',
        'prices/historical': 'Ready for historical price data', 
        'prices/pairs': 'Ready for trading pair data',
        'prices/__metadata': 'Folder metadata and descriptions'
      }
    });

  } catch (error) {
    console.error('[BuildProperPrices] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to build proper prices structure',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}