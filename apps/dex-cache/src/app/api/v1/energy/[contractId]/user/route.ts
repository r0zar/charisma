import { NextResponse } from 'next/server';
import { fetcHoldToEarnLogs } from '@/lib/energy/analytics';
import { kv } from '@vercel/kv';

const CACHE_DURATION = 60 * 5; // 5 minutes in seconds

// Cache key format for user energy analytics data
const getUserEnergyAnalyticsCacheKey = (contractId: string, address: string) =>
    `energy:user:analytics:${contractId}:${address}`;

export async function GET(
    request: Request,
    context: { params: { contractId: string } }
) {
    const { contractId } = await context.params;
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

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
        // Check for cached data first
        const cacheKey = getUserEnergyAnalyticsCacheKey(contractId, address);
        const cachedData = await kv.get(cacheKey);

        if (cachedData) {
            console.log(`Returning cached user energy analytics for ${contractId}/${address}`);
            return NextResponse.json({
                status: 'success',
                data: cachedData,
                fromCache: true
            }, { status: 200, headers });
        }

        // No cached data, fetch from blockchain
        console.log(`Fetching energy analytics for contract: ${contractId}, user: ${address}`);

        // Get logs from blockchain
        const allLogs = await fetcHoldToEarnLogs(contractId);

        // Filter logs for the specific user
        const userLogs = allLogs.filter(log => log.sender === address);

        if (!userLogs || userLogs.length === 0) {
            return NextResponse.json({
                status: 'success',
                data: null // No data for this user
            }, { status: 200, headers });
        }

        // Sort logs by block height or time
        const sortedLogs = [...userLogs].sort((a, b) => {
            return (a.block_height || 0) - (b.block_height || 0);
        });

        // Calculate user stats
        const totalEnergyHarvested = userLogs.reduce((sum, log) => sum + Number(log.energy), 0);
        const totalIntegralCalculated = userLogs.reduce((sum, log) => sum + Number(log.integral), 0);
        const harvestCount = userLogs.length;
        const averageEnergyPerHarvest = harvestCount > 0 ? totalEnergyHarvested / harvestCount : 0;

        // Calculate energy rate
        let estimatedEnergyRate = 0;
        let estimatedIntegralRate = 0;

        if (sortedLogs.length > 1 && sortedLogs[0].block_time && sortedLogs[sortedLogs.length - 1].block_time) {
            const timeSpanMinutes = (sortedLogs[sortedLogs.length - 1].block_time! - sortedLogs[0].block_time) / 60;
            if (timeSpanMinutes > 0) {
                estimatedEnergyRate = totalEnergyHarvested / timeSpanMinutes;
                estimatedIntegralRate = totalIntegralCalculated / timeSpanMinutes;
            }
        }

        // Format harvest history
        const harvestHistory = sortedLogs.map(log => ({
            timestamp: log.block_time_iso
                ? new Date(log.block_time_iso).getTime()
                : log.block_time ? log.block_time * 1000 : Date.now(),
            energy: Number(log.energy),
            integral: Number(log.integral),
            blockHeight: log.block_height,
            txId: log.tx_id
        }));

        // Get last harvest timestamp
        const lastHarvestTimestamp = harvestHistory.length > 0
            ? harvestHistory[harvestHistory.length - 1].timestamp
            : Date.now();

        // Assemble user data
        const userData = {
            address,
            totalEnergyHarvested,
            totalIntegralCalculated,
            harvestCount,
            averageEnergyPerHarvest,
            lastHarvestTimestamp,
            estimatedEnergyRate,
            estimatedIntegralRate,
            harvestHistory
        };

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