/**
 * Oracle-Only Cron Job - Fast Oracle Price Updates
 * 
 * Runs every minute to update oracle prices (BTC, sBTC, stablecoins) only.
 * This ensures oracle prices stay fresh with their 60-second TTL.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    OracleEngine,
    PriceSeriesStorage
} from '@services/prices';

// Environment validation
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required');
}

// Cache oracle engine (reuse across invocations)
let oracleEngine: OracleEngine | null = null;
let storage: PriceSeriesStorage | null = null;

/**
 * Initialize oracle engine and storage
 */
function initializeOracle(): { engine: OracleEngine; storage: PriceSeriesStorage } {
    if (!oracleEngine) {
        console.log('[OracleCron] Initializing oracle engine...');
        oracleEngine = new OracleEngine();
    }
    
    if (!storage) {
        storage = new PriceSeriesStorage(BLOB_READ_WRITE_TOKEN);
    }
    
    return { engine: oracleEngine, storage };
}

/**
 * Oracle tokens that need frequent updates
 */
const ORACLE_TOKENS = [
    {
        contractId: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
        symbol: 'sBTC'
    }
    // Additional oracle tokens can be added here (stablecoins, etc.)
];

/**
 * Main oracle cron job handler
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        console.log('[OracleCron] 🔄 Starting oracle price update...');

        // Verify this is a legitimate cron request (Vercel adds this header)
        const authHeader = request.headers.get('authorization');
        if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Initialize oracle components
        const { engine, storage: storageInstance } = initializeOracle();
        
        let successCount = 0;
        let errorCount = 0;
        const results = [];

        // Update each oracle token
        for (const token of ORACLE_TOKENS) {
            try {
                console.log(`[OracleCron] Updating ${token.symbol}...`);
                
                // Get BTC price from oracle (sBTC is 1:1 with BTC)
                const btcData = await engine.getBtcPrice();
                
                if (btcData) {
                    const tokenPriceData = {
                        tokenId: token.contractId,
                        symbol: token.symbol,
                        usdPrice: btcData.price,
                        sbtcRatio: 1.0,
                        lastUpdated: Date.now(),
                        source: 'oracle' as const,
                        reliability: btcData.reliability,
                        oracleData: {
                            asset: 'BTC',
                            source: btcData.source,
                            reliability: btcData.reliability === 1 ? 'high' as const : btcData.reliability > 0.7 ? 'medium' as const : 'low' as const,
                            timestamp: btcData.lastUpdated
                        }
                    };

                    // Update individual token price in KV with 60-second TTL
                    await storageInstance.updateTokenPrice(token.contractId, tokenPriceData);
                    
                    successCount++;
                    results.push({
                        token: token.symbol,
                        price: btcData.price,
                        source: btcData.source,
                        reliability: btcData.reliability
                    });
                    
                    console.log(`[OracleCron] ✅ ${token.symbol}: $${btcData.price} (${btcData.source})`);
                } else {
                    errorCount++;
                    console.warn(`[OracleCron] ❌ Failed to get ${token.symbol} price`);
                }
            } catch (error) {
                errorCount++;
                console.error(`[OracleCron] ❌ Error updating ${token.symbol}:`, error);
            }
        }

        const duration = Date.now() - startTime;
        const summary = {
            success: true,
            type: 'oracle-only',
            timestamp: Date.now(),
            duration,
            tokensProcessed: ORACLE_TOKENS.length,
            pricesUpdated: successCount,
            errors: errorCount,
            results
        };

        console.log(`[OracleCron] ✅ Oracle update complete: ${successCount}/${ORACLE_TOKENS.length} tokens updated in ${duration}ms`);

        return NextResponse.json(summary);

    } catch (error) {
        const duration = Date.now() - startTime;
        const errorSummary = {
            success: false,
            type: 'oracle-only',
            timestamp: Date.now(),
            duration,
            error: error instanceof Error ? error.message : 'Unknown error'
        };

        console.error('[OracleCron] ❌ Oracle update failed:', errorSummary);

        return NextResponse.json(errorSummary, { status: 500 });
    }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
    return GET(request);
}