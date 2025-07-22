import { NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Add sample token data to demonstrate simplified prices structure
 */
export async function GET() {
  try {
    // Sample tokens with current price and historical data
    const tokens = {
      'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': {
        currentPrice: 95420.50,
        source: 'coingecko-btc',
        lastUpdated: Date.now(),
        historical: [
          { timestamp: Date.now() - 86400000, usdPrice: 93200 }, // 1 day ago
          { timestamp: Date.now() - 43200000, usdPrice: 94100 }, // 12 hours ago
          { timestamp: Date.now() - 21600000, usdPrice: 94850 }, // 6 hours ago
          { timestamp: Date.now() - 3600000, usdPrice: 94800 },  // 1 hour ago
          { timestamp: Date.now() - 300000, usdPrice: 95100 },   // 5 minutes ago
          { timestamp: Date.now(), usdPrice: 95420.50 }          // now
        ],
        metadata: {
          contractId: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
          symbol: 'SBTC',
          name: 'Synthetic Bitcoin',
          decimals: 8
        }
      },
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token': {
        currentPrice: 0.0045,
        source: 'stxtools',
        lastUpdated: Date.now(),
        historical: [
          { timestamp: Date.now() - 86400000, usdPrice: 0.0042 }, // 1 day ago
          { timestamp: Date.now() - 43200000, usdPrice: 0.0043 }, // 12 hours ago
          { timestamp: Date.now() - 21600000, usdPrice: 0.0044 }, // 6 hours ago
          { timestamp: Date.now() - 3600000, usdPrice: 0.0044 },  // 1 hour ago
          { timestamp: Date.now() - 300000, usdPrice: 0.0045 },   // 5 minutes ago
          { timestamp: Date.now(), usdPrice: 0.0045 }            // now
        ],
        metadata: {
          contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
          symbol: 'CHA',
          name: 'Charisma Token',
          decimals: 6
        }
      },
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token': {
        currentPrice: 0.125,
        source: 'stxtools',
        lastUpdated: Date.now(),
        historical: [
          { timestamp: Date.now() - 86400000, usdPrice: 0.120 }, // 1 day ago
          { timestamp: Date.now() - 43200000, usdPrice: 0.122 }, // 12 hours ago
          { timestamp: Date.now() - 21600000, usdPrice: 0.124 }, // 6 hours ago
          { timestamp: Date.now() - 3600000, usdPrice: 0.123 },  // 1 hour ago
          { timestamp: Date.now() - 300000, usdPrice: 0.125 },   // 5 minutes ago
          { timestamp: Date.now(), usdPrice: 0.125 }            // now
        ],
        metadata: {
          contractId: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token',
          symbol: 'DIKO',
          name: 'Arkadiko Token',
          decimals: 6
        }
      }
    };

    // Store each token individually and also as a group
    const pricesBlob: any = {
      lastUpdated: new Date().toISOString(),
      source: 'sample-data',
      tokenCount: Object.keys(tokens).length
    };

    for (const [contractId, tokenData] of Object.entries(tokens)) {
      // Store individual token
      await unifiedBlobStorage.put(`prices/${contractId}`, tokenData);
      
      // Add to main prices blob for tree building
      pricesBlob[contractId] = tokenData;
    }

    // Store the main prices blob
    await unifiedBlobStorage.put('prices', pricesBlob);

    return NextResponse.json({
      success: true,
      message: 'Token data added successfully',
      data: {
        tokensAdded: Object.keys(tokens).length,
        tokens: Object.keys(tokens).map(contractId => {
          const parts = contractId.split('.');
          return parts.length === 2 ? parts[1].replace('-token', '').toUpperCase() : contractId;
        })
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}