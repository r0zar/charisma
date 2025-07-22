import { NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Add sample data to show what the prices view looks like with data
 */
export async function GET() {
  try {
    // Sample current prices
    const sampleCurrentPrices = {
      timestamp: Date.now(),
      prices: {
        'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': {
          usdPrice: 95420.50,
          source: 'coingecko-btc',
          timestamp: Date.now()
        },
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token': {
          usdPrice: 0.0045,
          source: 'stxtools',
          timestamp: Date.now()
        }
      },
      tokenCount: 2,
      source: 'sample-data'
    };

    // Sample pairs data
    const samplePairs = {
      timestamp: Date.now(),
      pairs: {
        'SBTC/USDC': {
          price: 95420.50,
          volume24h: 1250000,
          change24h: 2.34
        },
        'CHA/STX': {
          price: 0.0045,
          volume24h: 45000,
          change24h: -1.2
        }
      },
      pairCount: 2,
      source: 'sample-data'
    };

    // Sample historical data
    const sampleHistorical = {
      timestamp: Date.now(),
      timeframes: {
        '5m': {
          'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': [
            { timestamp: Date.now() - 300000, usdPrice: 95100 },
            { timestamp: Date.now() - 0, usdPrice: 95420.50 }
          ]
        },
        '1h': {
          'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': [
            { timestamp: Date.now() - 3600000, usdPrice: 94800 },
            { timestamp: Date.now() - 0, usdPrice: 95420.50 }
          ]
        },
        '1d': {
          'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': [
            { timestamp: Date.now() - 86400000, usdPrice: 93200 },
            { timestamp: Date.now() - 0, usdPrice: 95420.50 }
          ]
        }
      },
      totalTokens: 1,
      oldestEntry: Date.now() - 86400000,
      newestEntry: Date.now(),
      source: 'sample-data'
    };

    // Save all sample data
    await unifiedBlobStorage.put('prices/current', sampleCurrentPrices);
    await unifiedBlobStorage.put('prices/pairs', samplePairs);
    await unifiedBlobStorage.put('prices/historical', sampleHistorical);

    // Also add a summary for the root prices path
    const pricesSummary = {
      current: sampleCurrentPrices,
      pairs: samplePairs, 
      historical: sampleHistorical,
      lastUpdated: new Date().toISOString(),
      source: 'sample-data'
    };
    
    await unifiedBlobStorage.put('prices', pricesSummary);

    return NextResponse.json({
      success: true,
      message: 'Sample data added successfully',
      data: {
        current: Object.keys(sampleCurrentPrices.prices).length + ' tokens',
        pairs: samplePairs.pairCount + ' pairs',
        historical: sampleHistorical.totalTokens + ' tokens with historical data'
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}