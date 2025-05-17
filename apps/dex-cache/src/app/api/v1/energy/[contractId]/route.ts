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

    // Get query parameters
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const userAddress = url.searchParams.get('address') || undefined;

    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    console.log(`Energy analytics request for contract: ${contractId}`);
    if (forceRefresh) {
        console.log('Force refresh requested, skipping cache');
    }

    try {
        // Check for cached data first (unless refresh is requested)
        const cacheKey = getEnergyAnalyticsCacheKey(contractId);

        if (!forceRefresh) {
            const cachedData = await kv.get(cacheKey);

            if (cachedData) {
                console.log('Returning cached energy analytics');
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

        // Validate logs and filter out any with invalid timestamps
        const validLogs = logs.filter(log => {
            // Filter out logs with missing data
            if (!log || !log.sender || log.energy === undefined) return false;

            // Filter out logs with future timestamps (could be a data issue)
            if (log.block_time && log.block_time * 1000 > Date.now() + (86400 * 1000)) {
                console.log(`Filtering out log with future timestamp: ${new Date(log.block_time * 1000).toISOString()}`);
                return false;
            }

            return true;
        });

        console.log(`Found ${logs.length} total logs, ${validLogs.length} valid logs for processing`);

        // Check if we have valid logs
        const useRealData = validLogs.length > 0;
        // Use mock data only in development and when there's no real data
        const useMockData = process.env.NODE_ENV === 'development' && !useRealData;

        // If no logs, use mock data in development or return empty data
        if (!useRealData) {
            console.log('No valid logs found' + (useMockData ? ', using mock data for development' : ''));
            const mockRates = useMockData ? calculateMockRates() : { energyRate: 0, integralRate: 0 };

            return NextResponse.json({
                status: 'success',
                data: {
                    logs: useMockData ? mockEnergyLogs : [],
                    stats: {
                        totalEnergyHarvested: useMockData ? 67500 : 0,
                        totalIntegralCalculated: useMockData ? 337500 : 0,
                        uniqueUsers: useMockData ? 2 : 0,
                        lastUpdated: Date.now(),
                        averageEnergyPerHarvest: useMockData ? 11250 : 0,
                        averageIntegralPerHarvest: useMockData ? 56250 : 0
                    },
                    rates: {
                        overallEnergyPerMinute: useMockData ? mockRates.energyRate : 0,
                        overallIntegralPerMinute: useMockData ? mockRates.integralRate : 0,
                        topUserRates: useMockData ? [
                            { address: "SP2XYZ123ABC456DEF789GHI012JKL345MNO678P", energyPerMinute: mockRates.energyRate * 0.65 },
                            { address: "SP2ABC123DEF456GHI789JKL012MNO345PQR678S", energyPerMinute: mockRates.energyRate * 0.35 }
                        ] : [],
                        lastCalculated: Date.now(),
                        rateHistoryTimeframes: useMockData ? {
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

        // Process logs to calculate analytics - using valid logs only

        // 1. Group logs by user for per-user stats
        const userLogs = validLogs.reduce((acc: Record<string, any[]>, log) => {
            if (!acc[log.sender]) {
                acc[log.sender] = [];
            }
            acc[log.sender].push(log);
            return acc;
        }, {});

        // 2. Calculate global stats
        const uniqueUsers = Object.keys(userLogs).length;
        const totalEnergyHarvested = validLogs.reduce((sum, log) => sum + Number(log.energy), 0);
        const totalIntegralCalculated = validLogs.reduce((sum, log) => sum + Number(log.integral), 0);
        const averageEnergyPerHarvest = validLogs.length > 0 ? totalEnergyHarvested / validLogs.length : 0;
        const averageIntegralPerHarvest = validLogs.length > 0 ? totalIntegralCalculated / validLogs.length : 0;

        // 3. Calculate rates
        // Sort logs by block_time for time-series analysis
        const sortedLogs = [...validLogs].sort((a, b) => {
            return (a.block_time || 0) - (b.block_time || 0);
        });

        const firstLog = sortedLogs[0];
        const lastLog = sortedLogs[sortedLogs.length - 1];

        let overallEnergyPerMinute = 0;
        let overallIntegralPerMinute = 0;

        // Calculate average rates if we have enough data
        // Log diagnostic information to help debug rate calculations
        console.log('Rate calculation data:', {
            logsCount: validLogs.length,
            hasFirstLog: !!firstLog,
            hasLastLog: !!lastLog,
            firstLogTime: firstLog?.block_time,
            lastLogTime: lastLog?.block_time,
            totalEnergy: totalEnergyHarvested
        });

        if (firstLog && lastLog && firstLog.block_time && lastLog.block_time) {
            const timeSpanSeconds = Math.max(1, lastLog.block_time - firstLog.block_time);
            const timeSpanMinutes = timeSpanSeconds / 60;

            console.log('Time span for rate calculation:', {
                timeSpanSeconds,
                timeSpanMinutes,
                firstLogTimeISO: new Date(firstLog.block_time * 1000).toISOString(),
                lastLogTimeISO: new Date(lastLog.block_time * 1000).toISOString(),
            });

            if (timeSpanMinutes > 0) {
                overallEnergyPerMinute = totalEnergyHarvested / timeSpanMinutes;
                overallIntegralPerMinute = totalIntegralCalculated / timeSpanMinutes;
                console.log('Calculated rates:', { overallEnergyPerMinute, overallIntegralPerMinute });
            } else {
                // If the timespan is too small, use a conservative estimate
                overallEnergyPerMinute = totalEnergyHarvested / 60; // Estimate based on 1 hour
                overallIntegralPerMinute = totalIntegralCalculated / 60;
                console.log('Using estimated rates due to small timespan:', { overallEnergyPerMinute, overallIntegralPerMinute });
            }
        } else if (totalEnergyHarvested > 0) {
            // Fallback calculation if timestamps are missing
            overallEnergyPerMinute = totalEnergyHarvested / 1440; // Conservatively assume 24 hours
            overallIntegralPerMinute = totalIntegralCalculated / 1440;
            console.log('Using fallback rates due to missing timestamps:', { overallEnergyPerMinute, overallIntegralPerMinute });
        }

        // 4. Calculate user stats and rates
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
                const userTimeSpanMinutes = Math.max(1, (userLogsSorted[userLogsSorted.length - 1].block_time - userLogsSorted[0].block_time) / 60);
                if (userTimeSpanMinutes > 0) {
                    energyPerMinute = userEnergyTotal / userTimeSpanMinutes;
                }
            } else if (userEnergyTotal > 0) {
                // If we can't calculate a rate but have energy, use a conservative estimate
                energyPerMinute = userEnergyTotal / 1440; // Assume 24 hours
            }

            return {
                address,
                totalEnergyHarvested: userEnergyTotal,
                totalIntegralCalculated: userIntegralTotal,
                harvestCount,
                energyPerMinute,
                lastHarvestTimestamp: userLogsSorted[userLogsSorted.length - 1].block_time_iso
                    ? new Date(userLogsSorted[userLogsSorted.length - 1].block_time_iso).getTime()
                    : userLogsSorted[userLogsSorted.length - 1].block_time
                        ? userLogsSorted[userLogsSorted.length - 1].block_time * 1000
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

        // Prepare analytics results
        const analyticsData = {
            logs: validLogs,
            stats: {
                totalEnergyHarvested,
                totalIntegralCalculated,
                uniqueUsers,
                averageEnergyPerHarvest,
                averageIntegralPerHarvest,
                lastUpdated: Date.now()
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
            userStats: {}
        };

        // Filter user-specific data if an address was provided
        if (userAddress) {
            const userData = userStats.find(user => user.address === userAddress);
            if (userData) {
                analyticsData.userStats = {
                    [userAddress]: userData
                };
            }
        }

        // Cache the results
        await kv.set(cacheKey, analyticsData, { ex: CACHE_DURATION });

        // Add this data point to the history
        if (overallEnergyPerMinute > 0) {
            // Push the current rate as a history snapshot
            await kv.lpush(historyKey, {
                timestamp: Date.now(),
                energyRate: overallEnergyPerMinute,
                integralRate: overallIntegralPerMinute,
                totalEnergyHarvested,
                uniqueUsers
            });
            // Trim the history list to keep only the last 100 entries
            await kv.ltrim(historyKey, 0, 99);
        }

        return NextResponse.json({
            status: 'success',
            data: analyticsData
        }, { status: 200, headers });

    } catch (error) {
        console.error('Error fetching energy analytics:', error);
        return NextResponse.json({
            status: 'error',
            error: 'Failed to fetch energy analytics',
            message: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
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