'use server'

import { getAllVaultData, Vault } from "../pool-service";
import { revalidatePath } from "next/cache";
import { kv } from "@vercel/kv";
import { processAllEnergyData, EnergyAnalyticsData } from "@/lib/energy/analytics";
import { getUserEnergyStatsV2, EnergyAnalyticsData as EnergyAnalyticsDataV2 } from "@/lib/energy/analytics-v2";
import { getTokenMetadataCached, TokenCacheData } from "@repo/tokens";
import { callReadOnlyFunction } from "@repo/polyglot";
import { principalCV } from "@stacks/transactions";

// --- Constants for energy data processing (moved/adapted from cron route) ---
const MONITORED_CONTRACTS_FALLBACK = [
    'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn'
    // Add other energy contract IDs here if needed as a fallback
];

// Cache key functions (moved/adapted from cron route)
const getEnergyAnalyticsCacheKey = (contractId: string) => `energy:analytics:${contractId}`;
const getCronLastRunKey = () => `energy:cron:last_run`;
const getEnergyContractsKey = () => `energy:monitored_contracts`;
// ---

// Interface for HoldToEarnVaults (ENERGY type vaults)
export interface HoldToEarnVault {
    type: "ENERGY";
    protocol: "CHARISMA";
    contractId: string;
    contractAddress: string;
    contractName: string;
    name: string;
    image: string; // Can be a data URI or a URL
    base: string; // Example: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1"
    engineContractId: string; // Example: "SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn"
    reservesLastUpdatedAt: number; // Timestamp
}

// Updated function to fetch vaults from the API
export async function fetchHoldToEarnVaults(): Promise<HoldToEarnVault[]> {
    // getAllVaultData with type=ENERGY
    return getAllVaultData({ type: 'ENERGY' }) as any;
}

// Fetch real energy rates for individual engines
export async function fetchEngineRates(): Promise<Record<string, number>> {
    try {
        const engineRates: Record<string, number> = {};
        
        // Get all monitored energy contracts
        const monitoredContracts = await kv.get<string[]>(getEnergyContractsKey()) || MONITORED_CONTRACTS_FALLBACK;
        
        // Fetch analytics data for each engine
        for (const contractId of monitoredContracts) {
            try {
                const analyticsKey = getEnergyAnalyticsCacheKey(contractId);
                const analyticsData = await kv.get<EnergyAnalyticsData>(analyticsKey);
                
                if (analyticsData?.rates) {
                    // Convert from per-minute to per-second
                    const ratePerSecond = (analyticsData.rates.overallEnergyPerMinute || 0) / 60;
                    engineRates[contractId] = ratePerSecond;
                } else {
                    engineRates[contractId] = 0;
                }
            } catch (error) {
                console.warn(`Could not load analytics for ${contractId}:`, error);
                engineRates[contractId] = 0;
            }
        }
        
        return engineRates;
    } catch (error) {
        console.error('Error fetching engine rates:', error);
        return {};
    }
}

/**
 * Enhanced version of processAllEnergyData that uses analytics-v2 for improved rate calculations
 */
async function processAllEnergyDataV2(contractId: string, userAddress?: string): Promise<EnergyAnalyticsData> {
    console.log(`🔄 Processing energy data V2 for ${contractId}${userAddress ? ` (user: ${userAddress})` : ''}`);
    
    // Use the original processAllEnergyData to get the base data structure
    const baseData = await processAllEnergyData(contractId, userAddress);
    
    // Enhance user stats with v2 calculations
    const enhancedUserStats: Record<string, any> = {};
    
    if (userAddress) {
        // Process specific user with v2 analytics
        const userStatsV2 = getUserEnergyStatsV2(baseData.logs, userAddress);
        if (userStatsV2) {
            // Convert v2 stats to legacy format for compatibility
            enhancedUserStats[userAddress] = {
                address: userStatsV2.address,
                totalEnergyHarvested: userStatsV2.historical.totalEnergyHarvested,
                totalIntegralCalculated: userStatsV2.historical.totalIntegralCalculated,
                harvestCount: userStatsV2.historical.harvestCount,
                averageEnergyPerHarvest: userStatsV2.historical.averageEnergyPerHarvest,
                lastHarvestTimestamp: userStatsV2.historical.lastHarvestTimestamp,
                // Use the corrected rate calculations from v2
                estimatedEnergyRate: userStatsV2.currentRate.energyPerMinute,
                estimatedIntegralRate: 0, // Could be calculated if needed
                harvestHistory: userStatsV2.historical.harvestHistory.map(h => ({
                    timestamp: h.timestamp,
                    energy: h.energy,
                    integral: h.integral,
                    blockHeight: h.blockHeight,
                    txId: h.txId
                }))
            };
        }
    } else {
        // Process all users with v2 analytics
        const userLogs = baseData.logs.reduce((acc: Record<string, any[]>, log) => {
            if (!acc[log.sender]) {
                acc[log.sender] = [];
            }
            acc[log.sender].push(log);
            return acc;
        }, {});

        // Process top users (limit to 20 for performance)
        const topUsers = Object.keys(userLogs)
            .sort((a, b) => userLogs[b].length - userLogs[a].length)
            .slice(0, 20);

        for (const address of topUsers) {
            const userStatsV2 = getUserEnergyStatsV2(baseData.logs, address);
            if (userStatsV2) {
                enhancedUserStats[address] = {
                    address: userStatsV2.address,
                    totalEnergyHarvested: userStatsV2.historical.totalEnergyHarvested,
                    totalIntegralCalculated: userStatsV2.historical.totalIntegralCalculated,
                    harvestCount: userStatsV2.historical.harvestCount,
                    averageEnergyPerHarvest: userStatsV2.historical.averageEnergyPerHarvest,
                    lastHarvestTimestamp: userStatsV2.historical.lastHarvestTimestamp,
                    // Use the corrected rate calculations from v2
                    estimatedEnergyRate: userStatsV2.currentRate.energyPerMinute,
                    estimatedIntegralRate: 0,
                    harvestHistory: userStatsV2.historical.harvestHistory.map(h => ({
                        timestamp: h.timestamp,
                        energy: h.energy,
                        integral: h.integral,
                        blockHeight: h.blockHeight,
                        txId: h.txId
                    }))
                };
            }
        }
    }

    // Return enhanced data with v2 calculations
    return {
        ...baseData,
        userStats: enhancedUserStats
    };
}

/**
 * Core logic for processing energy data for all monitored contracts.
 * This function is intended to be called by server actions or the cron API route.
 * Now uses analytics-v2 for improved rate calculations.
 */
export async function runEnergyDataProcessingForAllContracts(): Promise<{
    success: boolean;
    timestamp: number;
    duration: number;
    results: Array<{
        contractId: string;
        success: boolean;
        logsCount?: number;
        error?: string;
    }>;
    error?: string;
}> {
    const now = Date.now();
    const lastRun = await kv.get<number>(getCronLastRunKey()) || 0;
    const timeSinceLastRun = now - lastRun;

    console.log(`🔄 Energy data processing V2 starting. Last run: ${new Date(lastRun).toISOString()} (${timeSinceLastRun / 1000 / 60} minutes ago)`);

    let contractsToMonitor = await kv.get<string[]>(getEnergyContractsKey());

    if (!contractsToMonitor || !Array.isArray(contractsToMonitor) || contractsToMonitor.length === 0) {
        console.log("No monitored contracts found in KV, using fallback and saving.");
        contractsToMonitor = MONITORED_CONTRACTS_FALLBACK;
        await kv.set(getEnergyContractsKey(), contractsToMonitor); // Save fallback for next time
    }

    if (contractsToMonitor.length === 0) {
        console.log("No energy contracts to monitor.");
        return {
            success: true,
            timestamp: now,
            duration: 0,
            results: []
        };
    }

    const startTime = Date.now();
    const processingResults = await Promise.allSettled(
        contractsToMonitor.map(async (contractId) => {
            try {
                console.log(`📊 Processing energy analytics V2 for ${contractId}`);
                const data: EnergyAnalyticsData = await processAllEnergyDataV2(contractId, undefined);
                const cacheKey = getEnergyAnalyticsCacheKey(contractId);
                await kv.set(cacheKey, data, { ex: 60 * 60 * 2 }); // 2 hour expiration
                console.log(`✅ Successfully processed ${data.logs.length} logs for ${contractId}`);
                return {
                    contractId,
                    success: true,
                    logsCount: data.logs.length
                };
            } catch (error) {
                console.error(`❌ Error processing energy for ${contractId}:`, error);
                return {
                    contractId,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        })
    );

    await kv.set(getCronLastRunKey(), now);
    const duration = Date.now() - startTime;
    console.log(`✅ Energy data processing V2 completed in ${duration}ms`);

    // Format results for the return value
    const formattedResults = processingResults.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            return {
                contractId: contractsToMonitor[index],
                success: false,
                error: result.reason?.toString() || 'Unknown error'
            };
        }
    });

    return {
        success: true,
        timestamp: now,
        duration,
        results: formattedResults
    };
}

/**
 * Fetches all stored energy analytics data from KV.
 * Retrieves data for all keys matching "energy:analytics:*".
 */
export async function getAllEnergyAnalyticsData(): Promise<Array<{ contractId: string; analyticsData: EnergyAnalyticsData | null }>> {
    try {
        const analyticsKeys = await kv.keys(`${getEnergyAnalyticsCacheKey('')}*`); // e.g., energy:analytics:*

        if (!analyticsKeys || analyticsKeys.length === 0) {
            console.log("No energy analytics keys found in KV.");
            return [];
        }

        const allAnalyticsData = await Promise.all(
            analyticsKeys.map(async (key) => {
                const data = await kv.get<EnergyAnalyticsData>(key);
                const contractId = key.substring(getEnergyAnalyticsCacheKey('').length);
                return { contractId, analyticsData: data };
            })
        );

        return allAnalyticsData;
    } catch (error) {
        console.error("Error fetching all energy analytics data:", error);
        return []; // Return empty array on error
    }
}

/**
 * Server action to trigger the energy data processing and revalidate the /energy page.
 */
export async function triggerEnergyDataProcessing(): Promise<void> {
    // Call the existing runEnergyDataProcessingForAllContracts function
    await runEnergyDataProcessingForAllContracts();

    // Revalidate the /energy page
    revalidatePath('/energy');
}

// Interface for the dashboard data for a single token
export interface EnergyTokenDashboardData {
    contractId: string;
    name: string;
    image?: string;
    currentAccumulatedEnergy: number;
    estimatedEnergyRatePerSecond: number;
    lastRateCalculationTimestamp: number; // Timestamp of when the rate/energy was last known definitively
    // Contract-wide stats
    contractTotalEnergyHarvested: number;
    contractUniqueUsers: number;
    contractTopUserRates: Array<{ address: string; energyPerMinute: number }>; // From EnergyAnalyticsData.rates.topUserRates
}

/**
 * Server Action to fetch consolidated dashboard data for all ENERGY tokens for a specific user.
 */
export async function getEnergyDashboardDataForUser(userAddress: string): Promise<EnergyTokenDashboardData[]> {
    if (!userAddress) {
        console.warn("getEnergyDashboardDataForUser called without userAddress");
        return [];
    }

    const energyVaults = await fetchHoldToEarnVaults(); // Gets all vaults of type 'ENERGY'
    if (!energyVaults || energyVaults.length === 0) {
        return [];
    }

    console.log('energyVaults', energyVaults);

    const dashboardDataList: EnergyTokenDashboardData[] = [];

    for (const vault of energyVaults) {
        const analyticsData = await kv.get<EnergyAnalyticsData>(getEnergyAnalyticsCacheKey(vault.engineContractId));

        console.log('analyticsData', analyticsData);

        let userSpecificEnergy = 0;
        let userSpecificRatePerSecond = 0;
        let userLastCalcTimestamp = Date.now(); // Default to now if no specific data

        const contractStats = analyticsData?.stats || {
            totalEnergyHarvested: 0,
            uniqueUsers: 0,
            // Fill with defaults if analyticsData or stats is missing
            totalIntegralCalculated: 0,
            averageEnergyPerHarvest: 0,
            averageIntegralPerHarvest: 0,
            lastUpdated: Date.now(),
        };
        const contractRates = analyticsData?.rates?.topUserRates || [];

        if (analyticsData && analyticsData.userStats && analyticsData.userStats[userAddress]) {
            const userStats = analyticsData.userStats[userAddress];
            if (userStats) {
                userSpecificEnergy = userStats.totalEnergyHarvested;
                userSpecificRatePerSecond = (userStats.estimatedEnergyRate || 0) / 60; // Convert per minute to per second
                userLastCalcTimestamp = userStats.lastHarvestTimestamp;
            }
        }

        dashboardDataList.push({
            contractId: vault.contractId,
            name: vault.name,
            image: vault.image,
            currentAccumulatedEnergy: userSpecificEnergy,
            estimatedEnergyRatePerSecond: userSpecificRatePerSecond,
            lastRateCalculationTimestamp: userLastCalcTimestamp,
            contractTotalEnergyHarvested: contractStats.totalEnergyHarvested,
            contractUniqueUsers: contractStats.uniqueUsers,
            contractTopUserRates: contractRates,
        });
    }

    return dashboardDataList;
}


export async function getEnergyTokenMetadata(): Promise<TokenCacheData> {
    const data = await getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy')
    return data;
}

export async function getUserMaxEnergyCapacity(userAddress: string): Promise<number> {
    const data = await callReadOnlyFunction(
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        'power-cells', 'get-max-capacity',
        [principalCV(userAddress)]);
    return Number(data);
}