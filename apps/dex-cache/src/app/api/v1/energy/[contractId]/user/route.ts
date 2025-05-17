import { NextResponse } from 'next/server';
import { fetcHoldToEarnLogs } from '@/lib/energy/analytics';
import { kv } from '@vercel/kv';
import { mockEnergyLogs } from '@/lib/energy/mocks';

const CACHE_DURATION = 60 * 5; // 5 minutes in seconds

// Cache key format for user energy analytics data
const getUserEnergyAnalyticsCacheKey = (contractId: string, address: string) =>
    `energy:user:analytics:${contractId}:${address}`;

interface HarvestHistoryItem {
    timestamp: number;
    energy: number;
    integral: number;
    blockHeight?: number;
    txId?: string;
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
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const useMocks = searchParams.get('useMocks') === 'true' || process.env.NODE_ENV === 'development';
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Set headers for caching and CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 12}` // 5 min edge, 1h SWR
    };

    if (!address) {
        return NextResponse.json({
            status: 'error',
            error: 'Address parameter is required'
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

        // Use mock data in development if no real data exists
        if (useMocks && (!allLogs || allLogs.length === 0)) {
            console.log('Using mock logs for development');
            allLogs = mockEnergyLogs.slice();
        }

        // Check if logs exist at all
        if (allLogs.length === 0) {
            console.log('No logs found for contract', contractId);
        } else {
            console.log(`Found ${allLogs.length} logs for contract ${contractId}`);
        }

        // Debug - check all sender addresses in logs
        const senderAddresses = new Set(allLogs.map(log => log.sender));
        console.log('All sender addresses in logs:', Array.from(senderAddresses));

        // IMPORTANT: Normalize the address to match the case sensitivity from the logs
        // Some blockchain addresses might be case-sensitive in comparisons
        const normalizedQueryAddress = address.trim();

        // Filter logs for the specific user (with detailed logging)
        console.log(`Filtering logs for user address: ${normalizedQueryAddress}`);

        const userLogs = allLogs.filter(log => {
            const senderMatches = log.sender === normalizedQueryAddress;
            // Log if we find a match
            if (senderMatches) {
                console.log(`Found matching log: ${log.tx_id} with energy ${log.energy}`);
            }
            return senderMatches;
        });

        console.log(`Found ${userLogs.length} logs for user ${normalizedQueryAddress}`);

        // Create default/empty user stats
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
            hasData: false
        };

        // If we have logs, calculate actual stats
        if (userLogs && userLogs.length > 0) {
            // Sort logs by block height or time
            const sortedLogs = [...userLogs].sort((a, b) => {
                return (a.block_height || 0) - (b.block_height || 0);
            });

            // Calculate user stats
            userData.totalEnergyHarvested = userLogs.reduce((sum, log) => sum + Number(log.energy), 0);
            userData.totalIntegralCalculated = userLogs.reduce((sum, log) => sum + Number(log.integral), 0);
            userData.harvestCount = userLogs.length;
            userData.averageEnergyPerHarvest = userData.harvestCount > 0 ? userData.totalEnergyHarvested / userData.harvestCount : 0;
            userData.hasData = true;

            // Calculate energy rate
            if (sortedLogs.length > 1 && sortedLogs[0].block_time && sortedLogs[sortedLogs.length - 1].block_time) {
                const timeSpanMinutes = (sortedLogs[sortedLogs.length - 1].block_time! - sortedLogs[0].block_time) / 60;
                if (timeSpanMinutes > 0) {
                    userData.estimatedEnergyRate = userData.totalEnergyHarvested / timeSpanMinutes;
                    userData.estimatedIntegralRate = userData.totalIntegralCalculated / timeSpanMinutes;
                }
            }

            // Format harvest history
            userData.harvestHistory = sortedLogs.map(log => ({
                timestamp: log.block_time_iso
                    ? new Date(log.block_time_iso).getTime()
                    : log.block_time ? log.block_time * 1000 : Date.now(),
                energy: Number(log.energy),
                integral: Number(log.integral),
                blockHeight: log.block_height,
                txId: log.tx_id
            }));

            // Get last harvest timestamp
            if (userData.harvestHistory.length > 0) {
                userData.lastHarvestTimestamp = userData.harvestHistory[userData.harvestHistory.length - 1].timestamp;
            }
        } else if (useMocks) {
            // Provide some mock data for better UI demonstration
            const mockRate = Math.floor(Math.random() * 10000) + 5000;
            userData.estimatedEnergyRate = mockRate;
            userData.estimatedIntegralRate = mockRate * 0.85;
            userData.hasData = false;
        }

        // Store in cache
        await kv.set(cacheKey, userData, { ex: CACHE_DURATION });

        return NextResponse.json({
            status: 'success',
            data: userData
        }, { status: 200, headers });

    } catch (error: any) {
        console.error(`Error fetching user energy analytics for ${contractId}/${address}:`, error);
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