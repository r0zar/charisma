/**
 * Route handler for prices/current
 * Custom logic for fetching and caching current price data
 */

import { NextResponse } from 'next/server';
import { oraclePriceService } from '../../../prices';
import { blobStorageService } from '../../../storage/blob-storage-service';
import type { RouteHandler, RouteContext } from '../../../routing/types';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const pricesCurrentHandler: RouteHandler = {
  path: 'prices/current',
  description: 'Fetch current token prices from multiple oracles with caching',
  version: '1.0.0',

  // Custom GET implementation with oracle integration
  async get(context: RouteContext): Promise<NextResponse> {
    context.performance.addMark('prices-handler-start');

    const forceRefresh = context.query.get('refresh') === 'true';
    
    console.log(`[PricesHandler] Getting current prices (refresh: ${forceRefresh})`);

    let prices: Record<string, any> = {};
    let dataSource = 'unknown';
    let cacheHit = false;

    // Step 1: Try blob cache first (unless forced refresh)
    if (!forceRefresh) {
      try {
        const blobData = await blobStorageService.get(context.blobPath);
        
        if (blobData && typeof blobData === 'object') {
          // Extract metadata and prices from the flat structure
          const { __metadata, ...priceData } = blobData;
          const metadata = __metadata || blobData; // fallback for old format
          
          const blobTimestamp = metadata.timestamp || 0;
          const age = Date.now() - blobTimestamp;
          
          if (age < CACHE_TTL) {
            console.log(`[PricesHandler] Using blob cache (age: ${Math.round(age / 1000)}s)`);
            
            // Return structured response
            context.performance.addMark('prices-handler-complete');
            
            return NextResponse.json({
              prices: priceData,  // Direct price data, not nested
              timestamp: blobTimestamp,
              tokenCount: metadata.tokenCount || Object.keys(priceData).length,
              source: 'blob-cache',
              age: Math.round(age / 1000)
            });
          }
        }
      } catch (error) {
        console.log('[PricesHandler] Blob cache miss, fetching fresh data');
      }
    }

    // Step 2: Fetch fresh data from oracle service
    try {
      console.log('[PricesHandler] Fetching from oracle service...');
      
      prices = await oraclePriceService.getAllPrices();
      dataSource = forceRefresh ? 'oracle-refresh' : 'oracle-fresh';

      // Step 3: Update blob storage with fresh data
      if (Object.keys(prices).length > 0) {
        // Save the prices directly without wrapping in another prices object
        const blobData = {
          ...prices,  // Spread the prices directly at root level
          __metadata: {
            timestamp: Date.now(),
            tokenCount: Object.keys(prices).length,
            source: 'oracle-service',
            lastUpdatedToken: findMostRecentToken(prices)
          }
        };

        // Save to blob (background)
        blobStorageService.put(context.blobPath, blobData).catch(error => {
          console.warn('[PricesHandler] Failed to update blob storage:', error);
        });

        console.log(`[PricesHandler] Updated blob storage with ${Object.keys(prices).length} prices`);
      }
    } catch (error) {
      console.error('[PricesHandler] Error fetching from oracle service:', error);
      
      // Fallback to stale data
      try {
        const staleData = await blobStorageService.get(context.blobPath);
        if (staleData && typeof staleData === 'object') {
          const { __metadata, ...priceData } = staleData;
          if (Object.keys(priceData).length > 0) {
            console.log('[PricesHandler] Using stale data as fallback');
            prices = priceData;
            dataSource = 'stale-fallback';
          }
        }
      } catch (fallbackError) {
        console.warn('[PricesHandler] Fallback also failed');
      }
    }

    context.performance.addMark('prices-handler-complete');

    return NextResponse.json({
      prices,
      timestamp: Date.now(),
      tokenCount: Object.keys(prices).length,
      source: dataSource,
      refreshed: !cacheHit
    });
  },

  // Custom PUT for updating specific token prices
  async put(context: RouteContext): Promise<NextResponse> {
    const data = await context.request.json();
    
    // Validate price data structure
    if (!data.prices || typeof data.prices !== 'object') {
      return NextResponse.json(
        { error: 'Invalid price data format. Expected { prices: {...} }' },
        { status: 400 }
      );
    }

    // Update blob storage
    const blobData = {
      ...data,
      timestamp: Date.now(),
      tokenCount: Object.keys(data.prices).length,
      source: 'manual-update'
    };

    await blobStorageService.put(context.blobPath, blobData);

    return NextResponse.json({
      success: true,
      message: 'Prices updated successfully',
      tokenCount: Object.keys(data.prices).length,
      timestamp: new Date().toISOString()
    });
  },

  // Override CRUD to use custom logic
  overrideCrud: true
};

// Helper function
function findMostRecentToken(prices: Record<string, any>): string {
    let mostRecent = '';
    let latestTime = 0;

    for (const [tokenId, priceData] of Object.entries(prices)) {
      if (priceData?.lastUpdated && priceData.lastUpdated > latestTime) {
        latestTime = priceData.lastUpdated;
        mostRecent = tokenId;
      }
    }

    return mostRecent;
}

export default pricesCurrentHandler;