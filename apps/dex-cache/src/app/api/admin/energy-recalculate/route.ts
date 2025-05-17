import { NextResponse } from 'next/server';
import { processAllEnergyData } from '@/lib/energy/analytics';
import { kv } from '@vercel/kv';

// Reuse the key format functions from the cron job
const getEnergyAnalyticsCacheKey = (contractId: string) => `energy:analytics:${contractId}`;
const getEnergyHistoryKey = (contractId: string) => `energy:history:${contractId}`;
const getEnergyContractsKey = () => `energy:monitored_contracts`;

// Admin secret for authentication
const ADMIN_SECRET = process.env.ADMIN_SECRET;

/**
 * Endpoint to manually recalculate energy data for a contract
 */
export async function GET(request: Request) {
    try {
        // Verify authorization
        const { searchParams } = new URL(request.url);
        const authKey = searchParams.get('key');
        const contractId = searchParams.get('contractId');

        // Basic auth check
        if (authKey !== ADMIN_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // If no specific contract provided, get all monitored contracts
        let contractsToProcess: string[] = [];

        if (contractId) {
            contractsToProcess = [contractId];
        } else {
            // Get all monitored contracts
            contractsToProcess = await kv.get<string[]>(getEnergyContractsKey()) || [
                'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn'
            ];
        }

        if (contractsToProcess.length === 0) {
            return NextResponse.json({
                error: 'No contracts found to process'
            }, { status: 400 });
        }

        // Process each contract
        const results = await Promise.allSettled(
            contractsToProcess.map(async (id) => {
                try {
                    console.log(`Admin: Recalculating energy data for ${id}`);

                    // Process the data with no mock data
                    const data = await processAllEnergyData(id, undefined);

                    // Save to cache
                    const cacheKey = getEnergyAnalyticsCacheKey(id);
                    await kv.set(cacheKey, data, { ex: 60 * 60 * 2 }); // 2 hour expiration

                    // Store historical snapshot for rate history
                    const historyKey = getEnergyHistoryKey(id);

                    // Get existing history
                    const history = await kv.get<any[]>(historyKey) || [];

                    // Add new snapshot with current energy rates
                    const snapshot = {
                        timestamp: Date.now(),
                        totalEnergyHarvested: data.stats.totalEnergyHarvested,
                        uniqueUsers: data.stats.uniqueUsers,
                        energyRate: data.rates.overallEnergyPerMinute
                    };

                    console.log('New energy snapshot data:', {
                        totalEnergyHarvested: data.stats.totalEnergyHarvested,
                        uniqueUsers: data.stats.uniqueUsers,
                        overallEnergyPerMinute: data.rates.overallEnergyPerMinute,
                        topUserRatesCount: data.rates.topUserRates.length,
                    });

                    // Ensure energy rate is not zero when there's actually energy harvested
                    if (snapshot.energyRate === 0 && snapshot.totalEnergyHarvested > 0 && data.rates.topUserRates.length > 0) {
                        // Fall back to the highest user rate if overall rate calculation failed
                        const highestUserRate = Math.max(...data.rates.topUserRates.map(ur => ur.energyPerMinute));
                        if (highestUserRate > 0) {
                            console.log(`Fixing zero energyRate with highest user rate: ${highestUserRate}`);
                            snapshot.energyRate = highestUserRate;
                        }
                    }

                    // Keep at most 100 snapshots
                    const updatedHistory = [...history, snapshot].slice(-100);

                    // Save updated history with a longer expiration (30 days)
                    await kv.set(historyKey, updatedHistory, { ex: 60 * 60 * 24 * 30 });

                    return {
                        contractId: id,
                        success: true,
                        logs: data.logs.length,
                        energyRate: snapshot.energyRate,
                        totalEnergyHarvested: snapshot.totalEnergyHarvested
                    };
                } catch (error) {
                    console.error(`Error processing ${id}:`, error);
                    return {
                        contractId: id,
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            })
        );

        // Format results
        return NextResponse.json({
            success: true,
            timestamp: Date.now(),
            results: results.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    return {
                        contractId: contractsToProcess[index],
                        success: false,
                        error: result.reason?.toString() || 'Unknown error'
                    };
                }
            })
        });
    } catch (error) {
        console.error('Error in admin energy recalculation:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
        }, { status: 500 });
    }
} 