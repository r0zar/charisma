import { NextResponse } from 'next/server';
import { processAllEnergyData } from '@/lib/energy/analytics';
import { mockEnergyLogs, calculateMockRates } from '@/lib/energy/mocks';
import { kv } from '@vercel/kv';

const CRON_SECRET = process.env.CRON_SECRET;

// List of vault contracts to monitor
// This could also be fetched from a database or KV store for more dynamic management
const MONITORED_CONTRACTS = [
    'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn'
    // Add other energy contract IDs here
];

// Cache key formats
const getEnergyAnalyticsCacheKey = (contractId: string) => `energy:analytics:${contractId}`;
const getCronLastRunKey = () => `energy:cron:last_run`;
const getEnergyContractsKey = () => `energy:monitored_contracts`;

/**
 * This handler will be invoked by a cron job to refresh analytics data
 * It can be scheduled to run every 10-30 minutes, or whatever interval you prefer
 */
export async function GET(request: Request) {
    try {
        // 1. Authorize the request
        const authHeader = request.headers.get('authorization');
        if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get current timestamp
        const now = Date.now();
        const lastRun = await kv.get<number>(getCronLastRunKey()) || 0;
        const timeSinceLastRun = now - lastRun;

        console.log(`Energy data collection cron running. Last run: ${new Date(lastRun).toISOString()} (${timeSinceLastRun / 1000 / 60} minutes ago)`);

        // Get the list of contracts to monitor
        // This allows for dynamic management of monitored contracts
        let contractsToMonitor = await kv.get<string[]>(getEnergyContractsKey());

        // If no contracts found in KV, use the hardcoded list and save it
        if (!contractsToMonitor || !Array.isArray(contractsToMonitor) || contractsToMonitor.length === 0) {
            contractsToMonitor = MONITORED_CONTRACTS;

            // Save the list for future use
            await kv.set(getEnergyContractsKey(), contractsToMonitor);
        }

        // Process each contract in parallel
        const startTime = Date.now();
        const results = await Promise.allSettled(
            contractsToMonitor.map(async (contractId) => {
                try {
                    console.log(`Cron: Processing analytics for ${contractId}`);

                    // Process the data (never use mock data in cron job)
                    const data = await processAllEnergyData(contractId, undefined);

                    // Save to cache with long expiration for cron-collected data
                    const cacheKey = getEnergyAnalyticsCacheKey(contractId);
                    await kv.set(cacheKey, data, { ex: 60 * 60 * 2 }); // 2 hour expiration

                    return {
                        contractId,
                        success: true,
                        logsCount: data.logs.length
                    };
                } catch (error) {
                    console.error(`Cron: Error processing ${contractId}:`, error);
                    return {
                        contractId,
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            })
        );

        // Update last run timestamp
        await kv.set(getCronLastRunKey(), now);

        const duration = Date.now() - startTime;
        console.log(`Energy data collection completed in ${duration}ms`);

        // Return summary
        return NextResponse.json({
            success: true,
            timestamp: now,
            duration,
            results: results.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    return {
                        contractId: contractsToMonitor[index],
                        success: false,
                        error: result.reason?.toString() || 'Unknown error'
                    };
                }
            })
        });
    } catch (error) {
        console.error('Error in energy data collection cron:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
        }, { status: 500 });
    }
}

/**
 * Endpoint to manually add a contract to the monitoring list
 */
export async function POST(request: Request) {
    try {
        // This could be protected with admin authentication
        const { contractId } = await request.json();

        if (!contractId || typeof contractId !== 'string' || !contractId.includes('.')) {
            return NextResponse.json({ error: 'Valid contractId is required' }, { status: 400 });
        }

        // Get current list
        const currentList = await kv.get<string[]>(getEnergyContractsKey()) || [];

        // Check if already exists
        if (currentList.includes(contractId)) {
            return NextResponse.json({
                success: true,
                message: 'Contract already in monitoring list',
                contracts: currentList
            });
        }

        // Add to list
        const newList = [...currentList, contractId];
        await kv.set(getEnergyContractsKey(), newList);

        // Immediately collect data for the new contract
        const data = await processAllEnergyData(contractId, undefined);
        const cacheKey = getEnergyAnalyticsCacheKey(contractId);
        await kv.set(cacheKey, data, { ex: 60 * 60 * 2 }); // 2 hour expiration

        return NextResponse.json({
            success: true,
            message: 'Contract added to monitoring list',
            contracts: newList
        });
    } catch (error) {
        console.error('Error adding contract to monitoring:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error'
        }, { status: 500 });
    }
}

/**
 * Endpoint to remove a contract from the monitoring list
 */
export async function DELETE(request: Request) {
    try {
        // This should be protected with admin authentication
        const { searchParams } = new URL(request.url);
        const contractId = searchParams.get('contractId');

        if (!contractId) {
            return NextResponse.json({ error: 'contractId parameter is required' }, { status: 400 });
        }

        // Get current list
        const currentList = await kv.get<string[]>(getEnergyContractsKey()) || [];

        // Check if exists
        if (!currentList.includes(contractId)) {
            return NextResponse.json({
                success: true,
                message: 'Contract not in monitoring list',
                contracts: currentList
            });
        }

        // Remove from list
        const newList = currentList.filter(id => id !== contractId);
        await kv.set(getEnergyContractsKey(), newList);

        return NextResponse.json({
            success: true,
            message: 'Contract removed from monitoring list',
            contracts: newList
        });
    } catch (error) {
        console.error('Error removing contract from monitoring:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error'
        }, { status: 500 });
    }
}