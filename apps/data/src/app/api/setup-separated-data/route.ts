import { NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Set up separated data structure: current prices in /prices, historical in /price-series
 */
export async function GET() {
  try {
    // Sample tokens with separated structure
    const tokens = [
      {
        contractId: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
        symbol: 'SBTC',
        name: 'Synthetic Bitcoin',
        decimals: 8,
        currentPrice: 95420.50,
        source: 'coingecko-btc'
      },
      {
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
        symbol: 'CHA', 
        name: 'Charisma Token',
        decimals: 6,
        currentPrice: 0.0045,
        source: 'stxtools'
      },
      {
        contractId: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token',
        symbol: 'DIKO',
        name: 'Arkadiko Token', 
        decimals: 6,
        currentPrice: 0.125,
        source: 'stxtools'
      }
    ];

    // Set up prices structure (current prices only)
    const pricesBlob: any = {
      lastUpdated: new Date().toISOString(),
      source: 'separated-structure',
      tokenCount: tokens.length
    };

    for (const token of tokens) {
      const tokenData = {
        currentPrice: token.currentPrice,
        source: token.source,
        lastUpdated: Date.now(),
        metadata: {
          contractId: token.contractId,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals
        }
      };

      // Store individual token in prices/
      await unifiedBlobStorage.put(`prices/${token.contractId}`, tokenData);
      
      // Add to main prices blob for tree building
      pricesBlob[token.contractId] = tokenData;
    }

    // Store the main prices blob
    await unifiedBlobStorage.put('prices', pricesBlob);

    // Set up price-series structure (historical data)
    const priceSeriesBlob: any = {
      lastUpdated: new Date().toISOString(),
      source: 'separated-structure',
      seriesCount: tokens.length
    };

    for (const token of tokens) {
      // Generate sample historical data
      const historical = [];
      const now = Date.now();
      for (let i = 23; i >= 0; i--) { // Last 24 hours
        const timestamp = now - (i * 3600000); // Every hour
        const basePrice = token.currentPrice;
        const variance = (Math.random() - 0.5) * 0.1; // +/- 5% variance
        const price = basePrice * (1 + variance);
        
        historical.push({
          timestamp,
          usdPrice: Number(price.toFixed(token.decimals === 8 ? 2 : 6)),
          source: token.source
        });
      }

      const seriesData = {
        dataPoints: historical,
        lastUpdated: Date.now(),
        metadata: {
          contractId: token.contractId,
          symbol: token.symbol,
          name: token.name,
          pointCount: historical.length
        }
      };

      // Store individual token series
      await unifiedBlobStorage.put(`price-series/${token.contractId}`, seriesData);
      
      // Add to main price-series blob for tree building
      priceSeriesBlob[token.contractId] = seriesData;
    }

    // Store the main price-series blob
    await unifiedBlobStorage.put('price-series', priceSeriesBlob);

    return NextResponse.json({
      success: true,
      message: 'Separated data structure created successfully',
      data: {
        prices: {
          tokenCount: tokens.length,
          tokens: tokens.map(t => t.symbol)
        },
        priceSeries: {
          seriesCount: tokens.length,
          dataPointsPerToken: 24,
          tokens: tokens.map(t => t.symbol)
        }
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}