import { NextResponse } from 'next/server';
import { getOracleHealth, getBtcPrice } from '@/lib/pricing/btc-oracle';
import { getPriceGraph } from '@/lib/pricing/price-graph';
import { listVaultTokens } from '@/lib/pool-service';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Cache for 1 minute on CDN
    'Cache-Control': 'public, s-maxage=60'
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    const startTime = Date.now();
    
    try {
        console.log('[Price Health API] Checking system health...');

        // Get BTC oracle health
        const [oracleHealth, btcPrice] = await Promise.all([
            getOracleHealth(),
            getBtcPrice()
        ]);

        // Get price graph statistics
        const graph = await getPriceGraph();
        const graphStats = graph.getStats();

        // Get token count
        const allTokens = await listVaultTokens();

        // Calculate health scores
        const btcOracleHealthy = btcPrice !== null && oracleHealth.consecutiveFailures < 3;
        const graphHealthy = graphStats.totalTokens > 0 && graphStats.totalPools > 0;
        const dataFreshness = graphStats.ageMs < 10 * 60 * 1000; // Less than 10 minutes old

        const overallHealth = btcOracleHealthy && graphHealthy && dataFreshness;

        // Build detailed health report
        const healthReport = {
            overall: {
                status: overallHealth ? 'healthy' : 'degraded',
                score: btcOracleHealthy && graphHealthy && dataFreshness ? 100 : 
                       btcOracleHealthy && graphHealthy ? 75 :
                       btcOracleHealthy ? 50 : 25
            },
            btcOracle: {
                status: btcOracleHealthy ? 'healthy' : 'degraded',
                currentPrice: btcPrice?.price || null,
                confidence: btcPrice?.confidence || 0,
                source: btcPrice?.source || 'none',
                lastSuccessfulUpdate: oracleHealth.lastSuccessfulUpdate,
                consecutiveFailures: oracleHealth.consecutiveFailures,
                availableSources: oracleHealth.availableSources,
                lastError: oracleHealth.lastError
            },
            priceGraph: {
                status: graphHealthy ? 'healthy' : 'error',
                totalTokens: graphStats.totalTokens,
                totalPools: graphStats.totalPools,
                sbtcPairCount: graphStats.sbtcPairCount,
                avgPoolsPerToken: graphStats.avgPoolsPerToken,
                lastUpdated: graphStats.lastUpdated,
                ageMinutes: Math.floor(graphStats.ageMs / (60 * 1000)),
                freshness: dataFreshness ? 'fresh' : 'stale'
            },
            dataAvailability: {
                totalTokensInSystem: allTokens.length,
                tokensWithPricing: graphStats.totalTokens,
                pricingCoverage: graphStats.totalTokens > 0 ? 
                    Math.round((graphStats.totalTokens / allTokens.length) * 100) : 0
            }
        };

        // Add warnings for potential issues
        const warnings = [];
        if (oracleHealth.consecutiveFailures > 0) {
            warnings.push(`BTC oracle has ${oracleHealth.consecutiveFailures} consecutive failures`);
        }
        if (graphStats.ageMs > 5 * 60 * 1000) {
            warnings.push(`Price graph is ${Math.floor(graphStats.ageMs / (60 * 1000))} minutes old`);
        }
        if (graphStats.sbtcPairCount === 0) {
            warnings.push('No direct sBTC pairs found - pricing may be unreliable');
        }
        if (graphStats.totalPools < 10) {
            warnings.push('Low pool count may affect pricing accuracy');
        }

        const processingTime = Date.now() - startTime;
        
        console.log(`[Price Health API] Health check completed in ${processingTime}ms: ${overallHealth ? 'HEALTHY' : 'DEGRADED'}`);

        return NextResponse.json({
            status: 'success',
            data: {
                ...healthReport,
                warnings: warnings.length > 0 ? warnings : undefined,
                timestamp: Date.now()
            },
            metadata: {
                processingTimeMs: processingTime,
                checkTime: new Date().toISOString()
            }
        }, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error('[Price Health API] Error during health check:', error);
        
        const processingTime = Date.now() - startTime;
        
        return NextResponse.json({
            status: 'error',
            error: 'Health Check Failed',
            message: process.env.NODE_ENV === 'development' ? error?.message : undefined,
            data: {
                overall: {
                    status: 'error',
                    score: 0
                },
                timestamp: Date.now()
            },
            metadata: {
                processingTimeMs: processingTime
            }
        }, {
            status: 500,
            headers
        });
    }
}