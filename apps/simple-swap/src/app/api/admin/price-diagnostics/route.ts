import { NextResponse } from "next/server";
import { getPricesInRange, getLatestPrice, getPriceHistoryInfo } from "@/lib/price/store";
import { listTokens } from "@/app/actions";
import { 
    calculateResilientRatioData, 
    extrapolateDataPoints,
    isValidDataPoint,
    type ChartDataPoint,
    type TimeRange 
} from "@/lib/chart-data-utils";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const action = searchParams.get('action') || 'health-check';

    try {
        switch (action) {
            case 'health-check':
                return await handleHealthCheck(contractId);
            case 'price-history':
                return await handlePriceHistory(contractId);
            case 'test-chart-data':
                return await handleTestChartData(contractId, request);
            case 'validate-tokens':
                return await handleValidateTokens();
            default:
                return NextResponse.json(
                    { error: 'Invalid action. Use: health-check, price-history, test-chart-data, validate-tokens' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Price diagnostics error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

async function handleHealthCheck(contractId: string | null) {
    if (!contractId) {
        return NextResponse.json(
            { error: 'contractId is required for health-check' },
            { status: 400 }
        );
    }

    const latestPrice = await getLatestPrice(contractId);
    const historyInfo = await getPriceHistoryInfo(contractId);
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    const recentPrices = await getPricesInRange(contractId, thirtyDaysAgo, now);
    
    // Test chart data format
    const chartData = recentPrices.map(([ts, price]) => ({
        time: Math.floor(ts / 1000),
        value: price,
    }));

    return NextResponse.json({
        contractId,
        status: latestPrice !== undefined ? 'healthy' : 'no-data',
        latestPrice,
        dataPoints: {
            total: historyInfo.totalDataPoints,
            last30Days: recentPrices.length
        },
        timestamps: {
            firstSeen: historyInfo.firstSeen,
            lastSeen: historyInfo.lastSeen
        },
        chartData: {
            format: 'lightweight-charts',
            sampleSize: Math.min(5, chartData.length),
            sample: chartData.slice(-5)
        },
        diagnostics: {
            hasData: latestPrice !== undefined,
            hasRecentData: recentPrices.length > 0,
            dataGaps: analyzeDataGaps(recentPrices),
            priceValidation: validatePriceData(recentPrices)
        }
    });
}

async function handlePriceHistory(contractId: string | null) {
    if (!contractId) {
        return NextResponse.json(
            { error: 'contractId is required for price-history' },
            { status: 400 }
        );
    }

    const historyInfo = await getPriceHistoryInfo(contractId);
    const now = Date.now();
    const timeframes = [
        { name: '1h', ms: 60 * 60 * 1000 },
        { name: '1d', ms: 24 * 60 * 60 * 1000 },
        { name: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
        { name: '30d', ms: 30 * 24 * 60 * 60 * 1000 }
    ];

    const timeframeData = await Promise.all(
        timeframes.map(async (tf) => {
            const from = now - tf.ms;
            const prices = await getPricesInRange(contractId, from, now);
            return {
                timeframe: tf.name,
                dataPoints: prices.length,
                firstPrice: prices[0] ? prices[0][1] : null,
                lastPrice: prices[prices.length - 1] ? prices[prices.length - 1][1] : null,
                priceChange: prices.length >= 2 ? 
                    ((prices[prices.length - 1][1] - prices[0][1]) / prices[0][1] * 100) : null
            };
        })
    );

    return NextResponse.json({
        contractId,
        historyInfo,
        timeframeAnalysis: timeframeData
    });
}

async function handleTestChartData(contractId: string | null, request: Request) {
    if (!contractId) {
        return NextResponse.json(
            { error: 'contractId is required for test-chart-data' },
            { status: 400 }
        );
    }

    const { searchParams } = new URL(request.url);
    const baseTokenId = searchParams.get('baseTokenId');

    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const prices = await getPricesInRange(contractId, thirtyDaysAgo, now);
    
    // Format for lightweight-charts
    const chartData = prices.map(([ts, price]) => ({
        time: Math.floor(ts / 1000),
        value: price,
    }));

    // Validate data format
    const validationResults = {
        totalPoints: chartData.length,
        validPoints: chartData.filter(p => 
            typeof p.time === 'number' && 
            typeof p.value === 'number' && 
            !isNaN(p.value) && 
            isFinite(p.value)
        ).length,
        timeRange: chartData.length > 0 ? {
            start: new Date(chartData[0].time * 1000).toISOString(),
            end: new Date(chartData[chartData.length - 1].time * 1000).toISOString()
        } : null,
        priceRange: chartData.length > 0 ? {
            min: Math.min(...chartData.map(p => p.value)),
            max: Math.max(...chartData.map(p => p.value))
        } : null
    };

    let ratioTestResults = null;
    
    // Test ratio calculation if base token is provided
    if (baseTokenId) {
        const basePrices = await getPricesInRange(baseTokenId, thirtyDaysAgo, now);
        const baseChartData = basePrices.map(([ts, price]) => ({
            time: Math.floor(ts / 1000),
            value: price,
        }));

        if (baseChartData.length > 0 && chartData.length > 0) {
            // Convert to ChartDataPoint format for utilities
            const tokenChartData: ChartDataPoint[] = chartData.map(p => ({
                time: Number(p.time),
                value: p.value
            }));
            const baseChartData_converted: ChartDataPoint[] = baseChartData.map(p => ({
                time: Number(p.time),
                value: p.value
            }));

            // Test extrapolation and ratio calculation
            const tokenTimes = chartData.map(p => Number(p.time) * 1000);
            const baseTimes = baseChartData.map(p => Number(p.time) * 1000);
            const allTimes = [...tokenTimes, ...baseTimes];
            const timeRange: TimeRange = {
                start: Math.min(...allTimes),
                end: Math.max(...allTimes)
            };

            const extrapolatedTokenData = extrapolateDataPoints(tokenChartData, timeRange);
            const extrapolatedBaseData = extrapolateDataPoints(baseChartData_converted, timeRange);
            const ratioData = calculateResilientRatioData(tokenChartData, baseChartData_converted);
            
            ratioTestResults = {
                baseToken: {
                    contractId: baseTokenId,
                    dataPoints: baseChartData.length,
                    extrapolatedPoints: extrapolatedBaseData.length,
                    wasExtrapolated: extrapolatedBaseData.length > baseChartData.length,
                    validPoints: baseChartData.filter(p => 
                        typeof p.time === 'number' && 
                        typeof p.value === 'number' && 
                        !isNaN(p.value) && 
                        isFinite(p.value)
                    ).length
                },
                conditionToken: {
                    dataPoints: chartData.length,
                    extrapolatedPoints: extrapolatedTokenData.length,
                    wasExtrapolated: extrapolatedTokenData.length > chartData.length,
                },
                ratio: {
                    dataPoints: ratioData.length,
                    sampleData: convertToApiFormat(ratioData.slice(-5)),
                    hasValidRatio: ratioData.length > 0,
                    resilient: ratioData.length > 0 // Now should always be true with extrapolation
                }
            };
        } else {
            ratioTestResults = {
                error: 'Insufficient data for ratio calculation',
                baseTokenDataPoints: baseChartData.length,
                conditionTokenDataPoints: chartData.length
            };
        }
    }

    return NextResponse.json({
        contractId,
        chartData: {
            format: 'lightweight-charts',
            data: chartData,
            validation: validationResults
        },
        ratioTest: ratioTestResults,
        apiTestUrl: `/api/price-series?contractId=${encodeURIComponent(contractId)}`,
        readyForChart: validationResults.validPoints > 0
    });
}

// Utility function to convert ChartDataPoint back to API format
function convertToApiFormat(data: ChartDataPoint[]): any[] {
    return data.map(point => ({
        time: point.time,
        value: point.value
    }));
}

async function handleValidateTokens() {
    const tokensResult = await listTokens();
    if (!tokensResult.success || !tokensResult.tokens) {
        return NextResponse.json({
            error: 'Failed to fetch tokens',
            details: tokensResult.error
        }, { status: 500 });
    }

    const tokenDiagnostics = await Promise.all(
        tokensResult.tokens.slice(0, 20).map(async (token) => {
            const latestPrice = await getLatestPrice(token.contractId);
            const historyInfo = await getPriceHistoryInfo(token.contractId);
            
            return {
                contractId: token.contractId,
                symbol: token.symbol,
                name: token.name,
                type: token.type,
                hasData: latestPrice !== undefined,
                latestPrice,
                totalDataPoints: historyInfo.totalDataPoints,
                lastSeen: historyInfo.lastSeen
            };
        })
    );

    const summary = {
        totalTokens: tokensResult.tokens.length,
        tokensWithData: tokenDiagnostics.filter(t => t.hasData).length,
        tokenTypes: Object.fromEntries(
            Object.entries(
                tokensResult.tokens.reduce((acc, t) => {
                    acc[t.type || 'unknown'] = (acc[t.type || 'unknown'] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>)
            )
        )
    };

    return NextResponse.json({
        summary,
        tokenDiagnostics: tokenDiagnostics.sort((a, b) => b.totalDataPoints - a.totalDataPoints)
    });
}

function analyzeDataGaps(prices: [number, number][]): { 
    hasGaps: boolean; 
    largestGap: number | null; 
    gapCount: number 
} {
    if (prices.length < 2) return { hasGaps: false, largestGap: null, gapCount: 0 };
    
    const gaps: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        const gap = prices[i][0] - prices[i-1][0];
        gaps.push(gap);
    }
    
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const largeGaps = gaps.filter(gap => gap > avgGap * 3);
    
    return {
        hasGaps: largeGaps.length > 0,
        largestGap: largeGaps.length > 0 ? Math.max(...largeGaps) : null,
        gapCount: largeGaps.length
    };
}

function validatePriceData(prices: [number, number][]): {
    valid: boolean;
    issues: string[];
} {
    const issues: string[] = [];
    
    if (prices.length === 0) {
        issues.push('No price data available');
        return { valid: false, issues };
    }
    
    // Check for invalid prices
    const invalidPrices = prices.filter(([, price]) => 
        !isFinite(price) || isNaN(price) || price <= 0
    );
    
    if (invalidPrices.length > 0) {
        issues.push(`${invalidPrices.length} invalid price values found`);
    }
    
    // Check for duplicate timestamps
    const timestamps = prices.map(([ts]) => ts);
    const uniqueTimestamps = new Set(timestamps);
    if (timestamps.length !== uniqueTimestamps.size) {
        issues.push('Duplicate timestamps found');
    }
    
    // Check for proper time ordering
    const unsortedPairs = prices.filter((current, index) => 
        index > 0 && current[0] < prices[index - 1][0]
    );
    
    if (unsortedPairs.length > 0) {
        issues.push('Prices are not properly time-ordered');
    }
    
    return {
        valid: issues.length === 0,
        issues
    };
}