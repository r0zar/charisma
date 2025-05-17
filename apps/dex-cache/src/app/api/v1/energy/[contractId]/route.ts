import { NextResponse } from 'next/server';
import { fetcHoldToEarnLogs } from '@/lib/energy/analytics';
import { kv } from '@vercel/kv';

const CACHE_DURATION = 60 * 5; // 5 minutes in seconds

// Cache key format for energy analytics data
const getEnergyAnalyticsCacheKey = (contractId: string) => `energy:analytics:${contractId}`;

export async function GET(
    _request: Request,
    context: { params: { contractId: string } }
) {
    const { contractId } = await context.params;

    // Set headers for caching and CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 12}` // 5 min edge, 1h SWR
    };

    try {
        // Check for cached data first
        const cacheKey = getEnergyAnalyticsCacheKey(contractId);
        const cachedData = await kv.get(cacheKey);

        if (cachedData) {
            console.log(`Returning cached energy analytics for ${contractId}`);
            return NextResponse.json({
                status: 'success',
                data: cachedData,
                fromCache: true
            }, { status: 200, headers });
        }

        // No cached data, fetch from blockchain
        console.log(`Fetching energy analytics for contract: ${contractId}`);

        // Get logs from blockchain
        const logs = await fetcHoldToEarnLogs(contractId);

        if (!logs || logs.length === 0) {
            return NextResponse.json({
                status: 'success',
                data: {
                    logs: [],
                    stats: {
                        totalEnergyHarvested: 0,
                        totalIntegralCalculated: 0,
                        uniqueUsers: 0,
                        lastUpdated: Date.now(),
                        averageEnergyPerHarvest: 0,
                        averageIntegralPerHarvest: 0
                    },
                    rates: {
                        overallEnergyPerMinute: 0,
                        overallIntegralPerMinute: 0,
                        topUserRates: [],
                        lastCalculated: Date.now(),
                        rateHistoryTimeframes: {
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
        // For the mock implementation, we'll create some sample data points
        // In a real implementation, you'd aggregate the logs by time periods

        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;

        // Generate sample rate history data (placeholder)
        // In a real implementation, you would aggregate actual data from logs
        const dailyRateHistory = Array(10).fill(0).map((_, i) => ({
            timestamp: now - (10 - i) * 2 * 60 * 60 * 1000, // 2-hour intervals
            rate: overallEnergyPerMinute * (0.8 + Math.random() * 0.4) // Slight random variation
        }));

        const weeklyRateHistory = Array(10).fill(0).map((_, i) => ({
            timestamp: now - (10 - i) * day, // daily points
            rate: overallEnergyPerMinute * (0.7 + Math.random() * 0.6)
        }));

        const monthlyRateHistory = Array(10).fill(0).map((_, i) => ({
            timestamp: now - (10 - i) * 3 * day, // 3-day points
            rate: overallEnergyPerMinute * (0.6 + Math.random() * 0.8)
        }));

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
        await kv.set(cacheKey, analyticsData, { ex: CACHE_DURATION });

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