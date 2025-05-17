import { NextResponse } from 'next/server';
import { fetcHoldToEarnLogs } from '@/lib/energy/analytics';
import { kv } from '@vercel/kv';
import { mockEnergyLogs } from '@/lib/energy/mocks';

const CACHE_DURATION = 60 * 5; // 5 minutes in seconds

// Cache key format for user energy analytics data
const getUserEnergyAnalyticsCacheKey = (contractId: string, address: string) =>
    `energy:user:analytics:${contractId}:${address}`;

// Format for timestamp validation
const isValidDate = (timestamp: number): boolean => {
    // Check if timestamp is a number and is within a reasonable range
    // (between 2020-01-01 and 1 day in the future)
    const now = Date.now();
    const jan2020 = new Date('2020-01-01').getTime();
    const oneDayFuture = now + (24 * 60 * 60 * 1000);

    return !isNaN(timestamp) && timestamp > jan2020 && timestamp < oneDayFuture;
};

// Utility to format timestamp safely
const formatTimestamp = (blockTime: number | undefined, blockTimeIso: string | undefined): number => {
    if (blockTimeIso) {
        const date = new Date(blockTimeIso);
        if (!isNaN(date.getTime())) {
            return date.getTime();
        }
    }

    if (blockTime) {
        // Convert seconds to milliseconds
        const timestamp = blockTime * 1000;
        if (isValidDate(timestamp)) {
            return timestamp;
        }
    }

    // Default to current time if we can't get a valid timestamp
    return Date.now();
};

interface HarvestHistoryItem {
    timestamp: number;
    energy: number;
    integral: number;
    blockHeight: number;
    txId: string;
    formattedTime?: string;
}

interface UserEnergyData {
    address: string;
    totalEnergyHarvested: number;
    totalIntegralCalculated: number;
    harvestCount: number;
    averageEnergyPerHarvest: number;
    lastHarvestTimestamp: number;
    estimatedEnergyRate: number;
    estimatedIntegralRate: number;
    harvestHistory: HarvestHistoryItem[];
    hasData: boolean;
}

export async function GET(
    request: Request,
    context: { params: { contractId: string } }
) {
    const { contractId } = await context.params;

    // Get query parameters
    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const useMocks = process.env.NODE_ENV === 'development';

    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    // Validate required parameters
    if (!address) {
        return NextResponse.json({
            status: 'error',
            error: 'Missing required parameter: address'
        }, { status: 400, headers });
    }

    try {
        // Check for cached data first (unless refresh is requested)
        const cacheKey = getUserEnergyAnalyticsCacheKey(contractId, address);

        if (!forceRefresh) {
            const cachedData = await kv.get(cacheKey);

            if (cachedData) {
                console.log(`Returning cached user energy analytics for ${contractId}/${address}`);
                return NextResponse.json({
                    status: 'success',
                    data: cachedData,
                    fromCache: true
                }, { status: 200, headers });
            }
        } else {
            console.log(`Force refresh requested, skipping cache for ${contractId}/${address}`);
        }

        // No cached data, fetch from blockchain
        console.log(`Fetching energy analytics for contract: ${contractId}, user: ${address}`);

        // Get logs from blockchain
        let allLogs = await fetcHoldToEarnLogs(contractId);

        console.log(`Fetched ${allLogs.length} logs for contract ${contractId}`);

        // Check if logs exist at all
        if (allLogs.length === 0) {
            console.log('No logs found for contract', contractId);
        } else {
            console.log(`Found ${allLogs.length} logs for contract ${contractId}`);
            // Log the first log to debug data structure
            if (allLogs.length > 0) {
                console.log('Sample log data:', {
                    tx_id: allLogs[0].tx_id,
                    sender: allLogs[0].sender,
                    energy: allLogs[0].energy,
                    block_time: allLogs[0].block_time,
                    block_time_iso: allLogs[0].block_time_iso,
                });
            }
        }

        // Debug - check all sender addresses in logs
        const senderAddresses = new Set(allLogs.map(log => log.sender));
        console.log('All sender addresses in logs:', Array.from(senderAddresses));

        // Filter logs for the specific user
        const userLogs = allLogs.filter(log => {
            // Ensure the sender matches and the log has valid data
            return log.sender === address && log.energy !== undefined;
        });

        console.log(`Found ${userLogs.length} logs for user ${address}`);

        // Initialize user data structure
        const userData: UserEnergyData = {
            address,
            totalEnergyHarvested: 0,
            totalIntegralCalculated: 0,
            harvestCount: 0,
            averageEnergyPerHarvest: 0,
            lastHarvestTimestamp: Date.now(),
            estimatedEnergyRate: 0,
            estimatedIntegralRate: 0,
            harvestHistory: [],
            hasData: false  // Will set to true if we have actual user logs
        };

        // Use mock data only if we have no logs at all
        if (userLogs.length === 0 && useMocks) {
            console.log('No user logs found, using mock data for development');
            const mockRate = Math.floor(Math.random() * 10000) + 5000;
            userData.estimatedEnergyRate = mockRate;
            userData.estimatedIntegralRate = mockRate * 0.85;
            userData.hasData = false;
        }
        // If we have logs, calculate actual stats
        else if (userLogs.length > 0) {
            console.log(`Processing ${userLogs.length} logs for user ${address}`);

            // Sort logs by block height or time
            const sortedLogs = [...userLogs].sort((a, b) => {
                return (a.block_height || 0) - (b.block_height || 0);
            });

            // Calculate user stats
            userData.totalEnergyHarvested = userLogs.reduce((sum, log) => sum + Number(log.energy), 0);
            userData.totalIntegralCalculated = userLogs.reduce((sum, log) => sum + Number(log.integral), 0);
            userData.harvestCount = userLogs.length;
            userData.averageEnergyPerHarvest = userData.harvestCount > 0 ? userData.totalEnergyHarvested / userData.harvestCount : 0;
            userData.hasData = true;  // Important: Mark as having data since we have logs

            // Calculate energy rate
            if (sortedLogs.length > 1 && sortedLogs[0].block_time && sortedLogs[sortedLogs.length - 1].block_time) {
                const timeSpanMinutes = Math.max(1, (sortedLogs[sortedLogs.length - 1].block_time! - sortedLogs[0].block_time) / 60);
                if (timeSpanMinutes > 0) {
                    userData.estimatedEnergyRate = userData.totalEnergyHarvested / timeSpanMinutes;
                    userData.estimatedIntegralRate = userData.totalIntegralCalculated / timeSpanMinutes;
                }
            } else if (userData.totalEnergyHarvested > 0) {
                // Fallback rate calculation if we don't have proper timestamps
                userData.estimatedEnergyRate = userData.totalEnergyHarvested / 1440; // Assume 24 hours
                userData.estimatedIntegralRate = userData.totalIntegralCalculated / 1440;
                console.log('Using fallback rate calculation due to missing timestamps');
            }

            // Create harvest history with validated timestamps
            userData.harvestHistory = sortedLogs.map(log => {
                const timestamp = formatTimestamp(log.block_time, log.block_time_iso);

                return {
                    timestamp,
                    energy: Number(log.energy),
                    integral: Number(log.integral),
                    blockHeight: log.block_height,
                    txId: log.tx_id,
                    formattedTime: new Date(timestamp).toISOString()
                };
            });

            // Set the last harvest timestamp from the most recent log
            if (userData.harvestHistory.length > 0) {
                // Sort by timestamp to get the most recent
                const sortedByTime = [...userData.harvestHistory].sort((a, b) => b.timestamp - a.timestamp);
                userData.lastHarvestTimestamp = sortedByTime[0].timestamp;
            }
        }

        // Cache the response even if empty
        await kv.set(cacheKey, userData, { ex: CACHE_DURATION });

        return NextResponse.json({
            status: 'success',
            data: userData
        }, { status: 200, headers });

    } catch (error) {
        console.error('Error fetching user energy analytics:', error);
        return NextResponse.json({
            status: 'error',
            error: 'Failed to fetch user energy analytics',
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