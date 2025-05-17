import { NextResponse } from 'next/server';
import { fetcHoldToEarnLogs, generateRateHistoryFromSnapshots } from '@/lib/energy/analytics';
import { mockEnergyLogs, calculateMockRates } from '@/lib/energy/mocks';
import { kv } from '@vercel/kv';

const CACHE_DURATION = 60 * 5; // 5 minutes in seconds

// Cache key formats
const getEnergyAnalyticsCacheKey = (contractId: string) => `energy:analytics:${contractId}`;
const getEnergyHistoryKey = (contractId: string) => `energy:history:${contractId}`;

export async function GET(
    request: Request,
    context: { params: { contractId: string } }
) {
    const { contractId } = await context.params;
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';

    // Set headers for caching and CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 12}` // 5 min edge, 1h SWR
    };

    try {
        // Check for cached data first (unless refresh is requested)
        if (!refresh) {
            const cacheKey = getEnergyAnalyticsCacheKey(contractId);
            const cachedData = await kv.get<{
                rates?: {
                    rateHistoryTimeframes: {
                        daily: any[];
                        weekly: any[];
                        monthly: any[];
                    }
                }
            }>(cacheKey);

            if (cachedData) {
                console.log(`Returning cached energy analytics for ${contractId}`);

                // Get historical data for rate history
                const historyKey = getEnergyHistoryKey(contractId);
                const historyData = await kv.get<any[]>(historyKey) || [];

                // Generate rate history timeframes from actual historical data
                const rateHistory = generateRateHistoryFromSnapshots(historyData);

                // Update the rate history in the cached data
                if (cachedData && cachedData.rates) {
                    cachedData.rates.rateHistoryTimeframes = rateHistory;
                }

                return NextResponse.json({
                    status: 'success',
                    data: cachedData,
                    fromCache: true
                }, { status: 200, headers });
            }
        }

        // No cached data, fetch from blockchain
        console.log(`Fetching energy analytics for contract: ${contractId}`);

        // Get logs from blockchain
        const logs = await fetcHoldToEarnLogs(contractId);

        if (!logs || logs.length === 0) {
            console.log('No logs found, using mock data for development');
            // Use mock data in development to show non-zero values
            const mockRates = calculateMockRates();

            return NextResponse.json({
                status: 'success',
                data: {
                    logs: process.env.NODE_ENV === 'development' ? mockEnergyLogs : [],
                    stats: {
                        totalEnergyHarvested: process.env.NODE_ENV === 'development' ? 67500 : 0,
                        totalIntegralCalculated: process.env.NODE_ENV === 'development' ? 337500 : 0,
                        uniqueUsers: process.env.NODE_ENV === 'development' ? 2 : 0,
                        lastUpdated: Date.now(),
                        averageEnergyPerHarvest: process.env.NODE_ENV === 'development' ? 11250 : 0,
                        averageIntegralPerHarvest: process.env.NODE_ENV === 'development' ? 56250 : 0
                    },
                    rates: {
                        overallEnergyPerMinute: process.env.NODE_ENV === 'development' ? mockRates.energyRate : 0,
                        overallIntegralPerMinute: process.env.NODE_ENV === 'development' ? mockRates.integralRate : 0,
                        topUserRates: process.env.NODE_ENV === 'development' ? [
                            { address: "SP2XYZ123ABC456DEF789GHI012JKL345MNO678P", energyPerMinute: mockRates.energyRate * 0.65 },
                            { address: "SP2ABC123DEF456GHI789JKL012MNO345PQR678S", energyPerMinute: mockRates.energyRate * 0.35 }
                        ] : [],
                        lastCalculated: Date.now(),
                        rateHistoryTimeframes: process.env.NODE_ENV === 'development' ? {
                            daily: Array(8).fill(0).map((_, i) => ({
                                timestamp: Date.now() - (8 - i) * 3 * 60 * 60 * 1000, // Every 3 hours
                                rate: mockRates.energyRate * (0.8 + Math.random() * 0.4)
                            })),
                            weekly: Array(7).fill(0).map((_, i) => ({
                                timestamp: Date.now() - (7 - i) * 24 * 60 * 60 * 1000, // Daily
                                rate: mockRates.energyRate * (0.7 + Math.random() * 0.6)
                            })),
                            monthly: Array(10).fill(0).map((_, i) => ({
                                timestamp: Date.now() - (10 - i) * 3 * 24 * 60 * 60 * 1000, // Every 3 days
                                rate: mockRates.energyRate * (0.6 + Math.random() * 0.8)
                            }))
                        } : {
                            daily: [],
                            weekly: [],
                            monthly: []
                        }
                    }
                }
            }, { status: 200, headers });
        }

        // Process logs to calculate analytics

        // 1. Group logs by user for per-user stats
        const userLogs = logs.reduce((acc: Record<string, any[]>, log) => {
            if (!acc[log.sender]) {
                acc[log.sender] = [];
            }
            acc[log.sender].push(log);
            return acc;
        }, {});

        // 2. Calculate global stats
        const uniqueUsers = Object.keys(userLogs).length;
        const totalEnergyHarvested = logs.reduce((sum, log) => sum + Number(log.energy), 0);
        const totalIntegralCalculated = logs.reduce((sum, log) => sum + Number(log.integral), 0);
        const averageEnergyPerHarvest = logs.length > 0 ? totalEnergyHarvested / logs.length : 0;
        const averageIntegralPerHarvest = logs.length > 0 ? totalIntegralCalculated / logs.length : 0;

        // 3. Calculate rates
        // Sort logs by block_height or time for time-series analysis
        const sortedLogs = [...logs].sort((a, b) => {
            return (a.block_height || 0) - (b.block_height || 0);
        });

        // Simple rate calculation (energy per block)
        const firstLog = sortedLogs[0];
        const lastLog = sortedLogs[sortedLogs.length - 1];

        let overallEnergyPerMinute = 0;
        let overallIntegralPerMinute = 0;

        // Calculate average rates if we have enough data
        if (firstLog && lastLog && firstLog.block_time && lastLog.block_time) {
            const timeSpanMinutes = (lastLog.block_time - firstLog.block_time) / 60;
            if (timeSpanMinutes > 0) {
                overallEnergyPerMinute = totalEnergyHarvested / timeSpanMinutes;
                overallIntegralPerMinute = totalIntegralCalculated / timeSpanMinutes;
            }
        }

        // 4. Calculate top users by energy harvested
        const userStats = Object.entries(userLogs).map(([address, logs]) => {
            const userEnergyTotal = logs.reduce((sum, log) => sum + Number(log.energy), 0);
            const userIntegralTotal = logs.reduce((sum, log) => sum + Number(log.integral), 0);
            const harvestCount = logs.length;

            // Sort user logs by time
            const userLogsSorted = [...logs].sort((a, b) => {
                return (a.block_time || 0) - (b.block_time || 0);
            });

            // Calculate user's energy rate (if enough data)
            let energyPerMinute = 0;
            if (userLogsSorted.length > 1 && userLogsSorted[0].block_time && userLogsSorted[userLogsSorted.length - 1].block_time) {
                const userTimeSpanMinutes = (userLogsSorted[userLogsSorted.length - 1].block_time - userLogsSorted[0].block_time) / 60;
                if (userTimeSpanMinutes > 0) {
                    energyPerMinute = userEnergyTotal / userTimeSpanMinutes;
                }
            }

            return {
                address,
                totalEnergyHarvested: userEnergyTotal,
                totalIntegralCalculated: userIntegralTotal,
                harvestCount,
                energyPerMinute,
                lastHarvestTimestamp: userLogsSorted[userLogsSorted.length - 1].block_time_iso
                    ? new Date(userLogsSorted[userLogsSorted.length - 1].block_time_iso).getTime()
                    : Date.now()
            };
        });

        // Sort by energy rate
        const topUserRates = userStats
            .sort((a, b) => b.energyPerMinute - a.energyPerMinute)
            .slice(0, 5)
            .map(user => ({
                address: user.address,
                energyPerMinute: user.energyPerMinute
            }));

        // 5. Generate rate history for timeframes
        // Get historical data for generating actual rate history
        const historyKey = getEnergyHistoryKey(contractId);
        const historyData = await kv.get<any[]>(historyKey) || [];

        // If we have historical data, use it; otherwise, generate placeholder data
        let dailyRateHistory, weeklyRateHistory, monthlyRateHistory;

        if (historyData.length > 1) {
            // Generate real rate history from stored snapshots
            const rateHistory = generateRateHistoryFromSnapshots(historyData);
            dailyRateHistory = rateHistory.daily;
            weeklyRateHistory = rateHistory.weekly;
            monthlyRateHistory = rateHistory.monthly;
        } else {
            // Fallback to placeholder data if no historical data yet
            const now = Date.now();
            const day = 24 * 60 * 60 * 1000;

            // Generate sample rate history data (placeholder)
            dailyRateHistory = Array(10).fill(0).map((_, i) => ({
                timestamp: now - (10 - i) * 2 * 60 * 60 * 1000, // 2-hour intervals
                rate: overallEnergyPerMinute * (0.8 + Math.random() * 0.4) // Slight random variation
            }));

            weeklyRateHistory = Array(10).fill(0).map((_, i) => ({
                timestamp: now - (10 - i) * day, // daily points
                rate: overallEnergyPerMinute * (0.7 + Math.random() * 0.6)
            }));

            monthlyRateHistory = Array(10).fill(0).map((_, i) => ({
                timestamp: now - (10 - i) * 3 * day, // 3-day points
                rate: overallEnergyPerMinute * (0.6 + Math.random() * 0.8)
            }));
        }

        // 6. Assemble response data
        const analyticsData = {
            logs: sortedLogs,
            stats: {
                totalEnergyHarvested,
                totalIntegralCalculated,
                uniqueUsers,
                lastUpdated: Date.now(),
                averageEnergyPerHarvest,
                averageIntegralPerHarvest
            },
            rates: {
                overallEnergyPerMinute,
                overallIntegralPerMinute,
                topUserRates,
                lastCalculated: Date.now(),
                rateHistoryTimeframes: {
                    daily: dailyRateHistory,
                    weekly: weeklyRateHistory,
                    monthly: monthlyRateHistory
                }
            },
            userStats: userStats.reduce((acc, user) => {
                acc[user.address] = user;
                return acc;
            }, {} as Record<string, any>)
        };

        // Store in cache
        await kv.set(getEnergyAnalyticsCacheKey(contractId), analyticsData, { ex: CACHE_DURATION });

        // Also store a snapshot for history if this was a fresh fetch
        if (historyData) {
            const snapshot = {
                timestamp: Date.now(),
                totalEnergyHarvested,
                uniqueUsers,
                energyRate: overallEnergyPerMinute
            };

            // Keep at most 100 snapshots to avoid excessive data storage
            const updatedHistory = [...historyData, snapshot].slice(-100);

            // Save updated history with a longer expiration (30 days)
            await kv.set(historyKey, updatedHistory, { ex: 60 * 60 * 24 * 30 });
        }

        // Get historical snapshots to improve rate history data
        let rateHistory = await kv.get<any[]>(historyKey) || [];

        console.log(`Found ${rateHistory.length} historical rate snapshots for ${contractId}`);

        // If we have historical data, use it to generate better rate history timeframes
        if (rateHistory.length > 0) {
            const generatedRateHistory = generateRateHistoryFromSnapshots(rateHistory);

            // Only override the rate history if we actually have data
            if (generatedRateHistory &&
                (generatedRateHistory.daily.length > 0 ||
                    generatedRateHistory.weekly.length > 0 ||
                    generatedRateHistory.monthly.length > 0)) {
                analyticsData.rates.rateHistoryTimeframes = generatedRateHistory;
                console.log('Using historical rate data for timeframes');
            } else {
                console.log('No valid historical rate data, using calculated rates');
            }
        }

        return NextResponse.json({
            status: 'success',
            data: analyticsData
        }, { status: 200, headers });

    } catch (error: any) {
        console.error(`Error fetching energy analytics for ${contractId}:`, error);
        return NextResponse.json({
            status: 'error',
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error?.message : undefined
        }, { status: 500, headers });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}