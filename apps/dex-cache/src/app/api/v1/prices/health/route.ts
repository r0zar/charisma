import { NextResponse } from 'next/server';
import { getOracleHealth, getBtcPrice } from '@/lib/pricing/btc-oracle';
import { getPriceGraph } from '@/lib/pricing/price-graph';
import { listVaultTokens, listVaults } from '@/lib/pool-service';
import { getMultipleTokenPrices } from '@/lib/pricing/price-calculator';

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Cache for 1 minute on CDN
    'Cache-Control': 'public, s-maxage=60'
};

/**
 * Calculate total pool value from all vault reserves
 */
async function calculateTotalPoolValue(): Promise<{ totalValue: number; poolCount: number }> {
    try {
        // Get all vaults and filter for pools
        const allVaults = await listVaults();
        const poolVaults = allVaults.filter(vault => vault.type === 'POOL');
        
        if (poolVaults.length === 0) {
            return { totalValue: 0, poolCount: 0 };
        }
        
        // Get all unique token IDs from pools
        const tokenIds = new Set<string>();
        poolVaults.forEach(vault => {
            if (vault.tokenA?.contractId) tokenIds.add(vault.tokenA.contractId);
            if (vault.tokenB?.contractId) tokenIds.add(vault.tokenB.contractId);
        });
        
        // Get current prices for all tokens
        const priceMap = await getMultipleTokenPrices(Array.from(tokenIds));
        const prices: Record<string, number> = {};
        priceMap.forEach((priceData, tokenId) => {
            if (priceData.usdPrice > 0) {
                prices[tokenId] = priceData.usdPrice;
            }
        });
        
        // Calculate total value across all pools
        let totalValue = 0;
        let validPools = 0;
        
        for (const vault of poolVaults) {
            if (!vault.tokenA || !vault.tokenB || vault.reservesA === undefined || vault.reservesB === undefined) {
                continue;
            }
            
            const priceA = prices[vault.tokenA.contractId];
            const priceB = prices[vault.tokenB.contractId];
            
            if (!priceA || !priceB || vault.reservesA === 0 || vault.reservesB === 0) {
                continue;
            }
            
            // Calculate token amounts in proper decimal representation
            const tokenADecimals = vault.tokenA.decimals || 6;
            const tokenBDecimals = vault.tokenB.decimals || 6;
            
            const tokenAAmount = vault.reservesA / Math.pow(10, tokenADecimals);
            const tokenBAmount = vault.reservesB / Math.pow(10, tokenBDecimals);
            
            // Calculate pool value
            const poolValueA = tokenAAmount * priceA;
            const poolValueB = tokenBAmount * priceB;
            const poolValue = poolValueA + poolValueB;
            
            totalValue += poolValue;
            validPools++;
        }
        
        return { totalValue, poolCount: validPools };
        
    } catch (error) {
        console.error('[Health API] Error calculating total pool value:', error);
        return { totalValue: 0, poolCount: 0 };
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    const startTime = Date.now();
    
    try {
        console.log('[Price Health API] Checking system health...');

        // Get BTC oracle health
        const [oracleHealth, btcPrice, poolValueData] = await Promise.all([
            getOracleHealth(),
            getBtcPrice(),
            calculateTotalPoolValue()
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
            },
            poolValue: {
                totalPoolValue: poolValueData.totalValue,
                validPools: poolValueData.poolCount,
                averagePoolSize: poolValueData.poolCount > 0 ? 
                    poolValueData.totalValue / poolValueData.poolCount : 0
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